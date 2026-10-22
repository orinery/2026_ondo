-- Custom SQL migration file, put your code below! --
-- 주문 처리 2/2: 0023(order_memos · refund_adjustments · settlement_adjustments · order_items.cancel_reason)에 이어
--   1) release_item 교체: 운영자 취소 사유 저장, 주문 환불 합계 = 모든 항목 환불액 합 (이용 완료 항목의 조정 환불 포함)
--   2) 관리자 함수: 운영자 취소(귀책 코드별 환불), 환불 조정(늘리기만, 정산 완료 달이면 조정 전표)
--   3) 정산 함수 교체: 조정 전표를 그 달 행으로 포함, 정산 완료 달 항목은 조정 전 값으로
--   4) 권한

-- ─── 1) release_item ──────────────────────────────────────────────────────
-- 항목 하나를 끝낸다 (취소·거절·만료 공통, 내부 전용 — 실행 권한 없음).
-- 좌석 반환 · 플래너 항목 삭제 · 주문 환불 합계/상태 갱신을 한곳에서 해서 카운터가 어긋나지 않게 한다.
-- 부르는 쪽이 주문 행과 항목 행을 잠그고 상태를 확인한 뒤 호출한다.
-- p_reason: 거절이면 거절 사유, 취소면 운영자 취소 사유(고객 본인 취소는 null)
create or replace function public.release_item(
  p_item_id uuid,
  p_status text,
  p_refund integer,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  if p_status not in ('cancelled', 'rejected', 'expired') then
    raise exception 'invalid_status';
  end if;

  select oi.order_id, oi.slot_id, oi.use_date, oi.adult_qty + oi.child_qty as qty
  into v_item
  from public.order_items oi
  where oi.id = p_item_id;

  update public.order_items oi
  set status = p_status::public.order_item_status,
      refund_amount = p_refund,
      cancelled_at = case when p_status in ('cancelled', 'expired') then now() else oi.cancelled_at end,
      rejected_at = case when p_status = 'rejected' then now() else oi.rejected_at end,
      reject_reason = case when p_status = 'rejected' then p_reason else oi.reject_reason end,
      cancel_reason = case when p_status = 'cancelled' then p_reason else oi.cancel_reason end
  where oi.id = p_item_id;

  update public.slot_inventory i
  set booked = i.booked - v_item.qty
  where i.slot_id = v_item.slot_id and i.use_date = v_item.use_date;

  delete from public.trip_items ti where ti.order_item_id = p_item_id;
  -- 주문이 자동으로 만든 여행이 비었으면 함께 지운다 (0006과 같은 규칙)
  delete from public.trips t
  where t.created_by_order_id = v_item.order_id
    and not exists (select 1 from public.trip_items ti where ti.trip_id = t.id);

  -- 주문: 환불 합계 = 모든 항목의 환불액 합 (살아 있는 항목은 null, 환불 조정된 이용 완료 항목도 포함).
  -- 살아 있는 항목이 없으면 주문 전체가 취소 상태
  update public.orders o
  set refund_amount = (
        select coalesce(sum(oi.refund_amount), 0)
        from public.order_items oi
        where oi.order_id = o.id
      ),
      status = case
        when exists (
          select 1 from public.order_items oi
          where oi.order_id = o.id and oi.status::text in ('pending', 'confirmed', 'used')
        ) then o.status
        else 'cancelled'
      end,
      cancelled_at = case
        when exists (
          select 1 from public.order_items oi
          where oi.order_id = o.id and oi.status::text in ('pending', 'confirmed', 'used')
        ) then o.cancelled_at
        else coalesce(o.cancelled_at, now())
      end
  where o.id = v_item.order_id;
end;
$$;
--> statement-breakpoint

-- ─── 2) 관리자 함수 ───────────────────────────────────────────────────────
-- 운영자 취소: 귀책 코드별 환불 (사용자 확정)
--   partner_operation(파트너 사정) · weather(기상·천재지변) · min_participants(최소 인원 미달) → 전액
--   customer_request(고객 요청 대행) → 고객 본인 취소와 같은 규정 계산(refund_quote)
-- 운영 코드는 이용일 당일까지(당일 기상 취소), 고객 요청은 고객 규칙과 같이 이용일 전날까지.
-- 메모는 사유 라벨과 함께 cancel_reason에 남아 고객·파트너에게 보인다
create or replace function public.admin_cancel_item(p_item_id uuid, p_reason_code text, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_label text;
  v_order_id uuid;
  v_item record;
  v_refund integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  v_label := case p_reason_code
    when 'partner_operation' then '파트너 사정'
    when 'weather' then '기상·천재지변'
    when 'min_participants' then '최소 인원 미달'
    when 'customer_request' then '고객 요청'
  end;
  if v_label is null then
    raise exception 'invalid_cancel_reason';
  end if;
  if v_note is null or char_length(v_note) > 200 then
    raise exception 'invalid_cancel_note';
  end if;

  -- 주문 행을 먼저 잠근다 (고객 취소·파트너 거절과 같은 순서)
  select oi.order_id into v_order_id from public.order_items oi where oi.id = p_item_id;
  if not found then
    raise exception 'not_found';
  end if;
  perform 1 from public.orders o where o.id = v_order_id for update;

  select oi.status::text as status, oi.use_date, oi.subtotal into v_item
  from public.order_items oi
  where oi.id = p_item_id
  for update;

  if v_item.status in ('cancelled', 'rejected', 'expired') then
    raise exception 'already_cancelled';
  end if;
  if v_item.status = 'used'
     or v_item.use_date < public.seoul_today()
     or (p_reason_code = 'customer_request' and v_item.use_date <= public.seoul_today()) then
    raise exception 'not_cancellable';
  end if;

  if p_reason_code = 'customer_request' then
    select q.refund_amount into v_refund
    from public.refund_quote(v_order_id) q
    where q.order_item_id = p_item_id;
  else
    v_refund := v_item.subtotal;
  end if;

  -- 감사 로그 트리거가 읽는 사유 (이 트랜잭션 안에서만)
  perform set_config('ondo.audit_reason_code', p_reason_code, true);
  perform set_config('ondo.audit_reason', v_label || ' — ' || v_note, true);
  perform public.release_item(p_item_id, 'cancelled', v_refund, v_label || ' — ' || v_note);
  return v_refund;
end;
$$;
--> statement-breakpoint

-- 환불 조정: 규정 밖 추가 환불 (분쟁 합의·수수료 면제 등). 늘리기만 한다.
-- 대상은 끝난 항목(취소·이용 완료·이용일 지난 확정) — 살아 있는 미래 항목은 운영자 취소로 처리한다.
-- 그 항목의 이용월이 이미 정산 완료됐으면 완료 숫자는 두고, 이번 달에 조정 전표(매출·수수료 차액)를 넣는다
create or replace function public.admin_adjust_refund(p_item_id uuid, p_amount integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_order_id uuid;
  v_item record;
  v_before integer;
  v_old_revenue integer;
  v_new_revenue integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if v_reason is null or char_length(v_reason) > 200 then
    raise exception 'invalid_adjust_reason';
  end if;

  select oi.order_id into v_order_id from public.order_items oi where oi.id = p_item_id;
  if not found then
    raise exception 'not_found';
  end if;
  perform 1 from public.orders o where o.id = v_order_id for update;

  select oi.status::text as status, oi.use_date, oi.subtotal, oi.refund_amount, oi.partner_id,
         oi.commission_rate
  into v_item
  from public.order_items oi
  where oi.id = p_item_id
  for update;

  if not (
    v_item.status in ('cancelled', 'used')
    or (v_item.status = 'confirmed' and v_item.use_date < public.seoul_today())
  ) then
    raise exception 'not_adjustable';
  end if;
  v_before := coalesce(v_item.refund_amount, 0);
  if p_amount is null or p_amount <= v_before or p_amount > v_item.subtotal then
    raise exception 'invalid_amount';
  end if;

  update public.order_items set refund_amount = p_amount where id = p_item_id;
  update public.orders o
  set refund_amount = (
    select coalesce(sum(oi.refund_amount), 0) from public.order_items oi where oi.order_id = o.id
  )
  where o.id = v_order_id;

  insert into public.refund_adjustments (order_item_id, before_amount, after_amount, reason, created_by)
  values (p_item_id, v_before, p_amount, v_reason, auth.uid());

  perform public.write_audit(
    'order_item', p_item_id, v_order_id, 'item.refund_adjusted',
    jsonb_build_object('refund_amount', v_before),
    jsonb_build_object('refund_amount', p_amount),
    v_reason
  );

  if exists (
    select 1 from public.settlements s
    where s.partner_id = v_item.partner_id and s.month = date_trunc('month', v_item.use_date)::date
  ) then
    v_old_revenue := v_item.subtotal - v_before;
    v_new_revenue := v_item.subtotal - p_amount;
    insert into public.settlement_adjustments (
      partner_id, month, order_item_id, revenue_delta, commission_delta, source, created_by
    )
    values (
      v_item.partner_id,
      date_trunc('month', public.seoul_today())::date,
      p_item_id,
      v_new_revenue - v_old_revenue,
      floor(v_new_revenue * v_item.commission_rate / 100)::integer
        - floor(v_old_revenue * v_item.commission_rate / 100)::integer,
      'refund_adjustment',
      auth.uid()
    );
  end if;
  return p_amount;
end;
$$;
--> statement-breakpoint

-- ─── 3) 정산 함수 ─────────────────────────────────────────────────────────
-- 정산 대상 항목 (실시간) + 조정 전표 — 파트너 정산 상세 화면과 월 합계가 같이 쓴다.
-- 정산 완료 뒤 환불을 조정한 항목은 원래 달에 "조정 전" 값으로 보여 완료 숫자와 맞추고,
-- 차액은 조정 전표 행(status = 'adjustment', 결제 0 · 환불 = 증액분 · 매출·수수료 = 음수)으로 반영할 달에 나온다
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
  select x.* from (
    select oi.id as item_id,
           oi.partner_id,
           date_trunc('month', oi.use_date)::date as month,
           o.order_no,
           oi.product_title,
           oi.use_date,
           oi.status::text as status,
           oi.subtotal,
           r.refund,
           oi.subtotal - r.refund as revenue,
           oi.commission_rate,
           floor((oi.subtotal - r.refund) * oi.commission_rate / 100)::integer as commission
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    cross join lateral (
      -- 조정 전 환불액 = 지금 환불액 − 정산 완료 뒤 늘린 금액 (revenue_delta는 음수)
      select (coalesce(oi.refund_amount, 0) + coalesce((
        select sum(a.revenue_delta) from public.settlement_adjustments a where a.order_item_id = oi.id
      ), 0))::integer as refund
    ) r
    where (v.o_all or oi.partner_id = v.o_partner)
      and oi.use_date >= date_trunc('month', p_from)::date
      and oi.use_date < (date_trunc('month', p_to) + interval '1 month')::date
      and (
        oi.status::text = 'used'
        or (oi.status::text = 'confirmed' and oi.use_date < public.seoul_today())
        or (oi.status::text = 'cancelled' and r.refund < oi.subtotal)
      )
    union all
    select a.order_item_id,
           a.partner_id,
           a.month,
           o.order_no,
           oi.product_title,
           oi.use_date,
           'adjustment',
           0,
           -a.revenue_delta,
           a.revenue_delta,
           oi.commission_rate,
           a.commission_delta
    from public.settlement_adjustments a
    join public.order_items oi on oi.id = a.order_item_id
    join public.orders o on o.id = oi.order_id
    where (v.o_all or a.partner_id = v.o_partner)
      and a.month >= date_trunc('month', p_from)::date
      and a.month < (date_trunc('month', p_to) + interval '1 month')::date
  ) x
  order by x.status = 'adjustment', x.use_date, x.item_id;
end;
$$;
--> statement-breakpoint

-- 월별 정산 요약: 정산 완료된 달은 고정된 숫자, 아니면 실시간 계산 (건수에 조정 전표는 세지 않는다)
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
    select si.partner_id, si.month,
           (count(*) filter (where si.status <> 'adjustment'))::integer as n,
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

-- 관리자: 지난달(이용월이 끝난 달) 정산 완료 처리 → 그 시점 숫자를 고정한다 (모의 — 실제 송금 없음).
-- 그 달에 들어온 조정 전표도 금액에 포함한다 (건수에는 세지 않는다)
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

  select (count(*) filter (where si.status <> 'adjustment'))::integer,
         coalesce(sum(si.revenue), 0)::integer,
         coalesce(sum(si.commission), 0)::integer
  into v_count, v_revenue, v_commission
  from public.settlement_items(p_partner, v_month, v_month) si;

  insert into public.settlements (partner_id, month, item_count, revenue, commission, payout, settled_by)
  values (p_partner, v_month, v_count, v_revenue, v_commission, v_revenue - v_commission, auth.uid());
  return v_revenue - v_commission;
end;
$$;
--> statement-breakpoint

-- ─── 4) 권한 ───────────────────────────────────────────────────────────
revoke all on public.order_memos from anon, authenticated;
--> statement-breakpoint
-- 어떤 행인지는 RLS(관리자만)가 정한다. 메모는 내용만 쓴다 (작성자는 기본값 auth.uid())
grant select on public.order_memos to authenticated;
--> statement-breakpoint
grant insert (order_id, body) on public.order_memos to authenticated;
--> statement-breakpoint
revoke all on public.refund_adjustments from anon, authenticated;
--> statement-breakpoint
grant select on public.refund_adjustments to authenticated;
--> statement-breakpoint
revoke all on public.settlement_adjustments from anon, authenticated;
--> statement-breakpoint
-- 파트너는 자기 조정 전표, 관리자는 전체 (RLS). 쓰기는 admin_adjust_refund만
grant select on public.settlement_adjustments to authenticated;
--> statement-breakpoint

revoke execute on function public.admin_cancel_item(uuid, text, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.admin_adjust_refund(uuid, integer, text) from public, anon, authenticated;
--> statement-breakpoint
-- 관리자 함수도 authenticated에게 준다: 함수 안에서 is_admin()으로 다시 거른다
grant execute on function public.admin_cancel_item(uuid, text, text) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_adjust_refund(uuid, integer, text) to authenticated;
