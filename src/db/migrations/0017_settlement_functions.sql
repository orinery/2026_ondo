-- Custom SQL migration file, put your code below! --
-- 정산 2/2: 0016(settlements 테이블)에 이어 정산 계산 함수와 관리자 정산 완료 처리
--
-- 정산 규칙 (사용자 확정: 고정 수수료, 이용월 기준, 실제 송금 없음)
--   대상 항목 (이용일이 속한 달로 묶는다):
--     - 이용 완료(used), 확정 + 이용일 지남(confirmed)  → 매출 = 결제액
--     - 취소(cancelled)인데 일부만 환불됨              → 매출 = 결제액 - 환불액 (규정상 돌려주지 않은 금액은 파트너 몫)
--     - 거절·만료(전액 환불), 전액 환불된 취소, 이용 전 확정·확정 대기 → 제외
--   수수료 = floor(매출 × 주문 당시 수수료율 / 100)  — 항목마다 계산해 더한다 (수수료율이 바뀌어도 지난 주문은 그대로)
--   지급액 = 매출 - 수수료
--   관리자가 지난달을 "정산 완료" 처리하면 그 숫자를 settlements에 고정한다. 없으면 실시간 계산 = "정산 예정".

-- 누구의 정산을 볼 수 있나: 관리자는 지정한 파트너(null = 전체), 파트너는 항상 자기 자신, 그 외는 거부
create or replace function public.settlement_scope(
  p_partner uuid,
  out o_partner uuid,
  out o_all boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    o_partner := p_partner;
    o_all := p_partner is null;
  elsif public.my_partner_id() is not null then
    -- 파트너가 다른 파트너 id를 넘겨도 자기 것만 본다
    o_partner := public.my_partner_id();
    o_all := false;
  else
    raise exception 'forbidden';
  end if;
end;
$$;
--> statement-breakpoint

-- 정산 대상 항목 (실시간) — 파트너 정산 상세 화면과 월 합계가 같이 쓴다
create or replace function public.settlement_items(p_partner uuid, p_from date, p_to date)
returns table (
  item_id uuid,
  partner_id uuid,
  month date,
  order_no text,
  product_title text,
  use_date date,
  status text,
  subtotal integer,
  refund integer,
  revenue integer,
  commission_rate numeric,
  commission integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v record;
begin
  select * into v from public.settlement_scope(p_partner);
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'invalid_range';
  end if;

  return query
  select oi.id,
         oi.partner_id,
         date_trunc('month', oi.use_date)::date,
         o.order_no,
         oi.product_title,
         oi.use_date,
         oi.status::text,
         oi.subtotal,
         coalesce(oi.refund_amount, 0),
         oi.subtotal - coalesce(oi.refund_amount, 0),
         oi.commission_rate,
         floor((oi.subtotal - coalesce(oi.refund_amount, 0)) * oi.commission_rate / 100)::integer
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where (v.o_all or oi.partner_id = v.o_partner)
    and oi.use_date >= date_trunc('month', p_from)::date
    and oi.use_date < (date_trunc('month', p_to) + interval '1 month')::date
    and (
      oi.status::text = 'used'
      or (oi.status::text = 'confirmed' and oi.use_date < public.seoul_today())
      or (oi.status::text = 'cancelled' and coalesce(oi.refund_amount, 0) < oi.subtotal)
    )
  order by oi.use_date, oi.id;
end;
$$;
--> statement-breakpoint

-- 월별 정산 요약: 정산 완료된 달은 고정된 숫자, 아니면 실시간 계산
create or replace function public.settlement_summary(p_partner uuid, p_from date, p_to date)
returns table (
  partner_id uuid,
  partner_name text,
  month date,
  item_count integer,
  revenue integer,
  commission integer,
  payout integer,
  settled_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v record;
begin
  select * into v from public.settlement_scope(p_partner);

  return query
  with live as (
    select si.partner_id, si.month, count(*)::integer as n,
           sum(si.revenue)::integer as rev, sum(si.commission)::integer as com
    from public.settlement_items(p_partner, p_from, p_to) si
    group by si.partner_id, si.month
  ), saved as (
    select s.partner_id, s.month, s.item_count, s.revenue, s.commission, s.payout, s.settled_at
    from public.settlements s
    where (v.o_all or s.partner_id = v.o_partner)
      and s.month between date_trunc('month', p_from)::date and date_trunc('month', p_to)::date
  ), keys as (
    select l.partner_id, l.month from live l
    union
    select sv.partner_id, sv.month from saved sv
  )
  select k.partner_id,
         pa.name,
         k.month,
         coalesce(sv.item_count, l.n, 0),
         coalesce(sv.revenue, l.rev, 0),
         coalesce(sv.commission, l.com, 0),
         coalesce(sv.payout, l.rev - l.com, 0),
         sv.settled_at
  from keys k
  join public.partners pa on pa.id = k.partner_id
  left join live l on l.partner_id = k.partner_id and l.month = k.month
  left join saved sv on sv.partner_id = k.partner_id and sv.month = k.month
  order by k.month desc, pa.name;
end;
$$;
--> statement-breakpoint

-- 관리자: 지난달(이용월이 끝난 달) 정산 완료 처리 → 그 시점 숫자를 고정한다 (모의 — 실제 송금 없음)
create or replace function public.admin_settle_month(p_partner uuid, p_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_count integer;
  v_revenue integer;
  v_commission integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if v_month >= date_trunc('month', public.seoul_today())::date then
    raise exception 'month_not_ended';
  end if;
  if not exists (select 1 from public.partners pa where pa.id = p_partner) then
    raise exception 'not_found';
  end if;
  if exists (
    select 1 from public.settlements s where s.partner_id = p_partner and s.month = v_month
  ) then
    raise exception 'already_settled';
  end if;

  select count(*)::integer, coalesce(sum(si.revenue), 0)::integer, coalesce(sum(si.commission), 0)::integer
  into v_count, v_revenue, v_commission
  from public.settlement_items(p_partner, v_month, v_month) si;

  insert into public.settlements (partner_id, month, item_count, revenue, commission, payout, settled_by)
  values (p_partner, v_month, v_count, v_revenue, v_commission, v_revenue - v_commission, auth.uid());
  return v_revenue - v_commission;
end;
$$;
--> statement-breakpoint

-- 권한
revoke all on public.settlements from anon, authenticated;
--> statement-breakpoint
-- 어떤 행인지는 RLS(본인 파트너·관리자)가 정한다. 쓰기는 admin_settle_month만
grant select on public.settlements to authenticated;
--> statement-breakpoint
revoke execute on function public.settlement_scope(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.settlement_items(uuid, date, date) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.settlement_summary(uuid, date, date) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_settle_month(uuid, date) from public, anon, authenticated;
--> statement-breakpoint
-- 함수 안에서 settlement_scope·is_admin()으로 다시 거른다
grant execute on function public.settlement_items(uuid, date, date) to authenticated;
--> statement-breakpoint
grant execute on function public.settlement_summary(uuid, date, date) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_settle_month(uuid, date) to authenticated;
