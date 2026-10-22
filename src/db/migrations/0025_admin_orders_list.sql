-- Custom SQL migration file, put your code below! --
-- 관리자 주문 목록: 검색 · 상태 · 파트너 · 결제일 기간 필터 + 페이지 (화면·CSV 내려받기 공용)
--   1) admin_orders
--   2) 권한

-- ─── 1) admin_orders ──────────────────────────────────────────────────────
-- 주문 상태는 화면 규칙(src/lib/order-status.ts displayStatus)과 같다:
--   cancelled(주문 전체 취소) → pending(확정 대기 항목이 있음) → upcoming(이용일이 남은 확정 항목) → used
-- p_status: all · pending · upcoming · used · cancelled · partial(끝난 항목과 살아 있는 항목이 섞임 = 부분 취소)
-- 항목 수는 상태별로 돌려준다: pending · upcoming(이용 전 확정) · used(이용 완료·이용일 지난 확정) · closed(취소·거절·만료)
create or replace function public.admin_orders(
  p_q text,
  p_status text,
  p_partner uuid,
  p_from date,
  p_to date,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  order_no text,
  display_status text,
  partial boolean,
  booker_name text,
  total_amount integer,
  refund_amount integer,
  paid_at timestamptz,
  first_title text,
  item_count integer,
  pending_count integer,
  upcoming_count integer,
  used_count integer,
  closed_count integer,
  partner_names text,
  total_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_q text := lower(nullif(btrim(coalesce(p_q, '')), ''));
  v_status text := coalesce(nullif(p_status, ''), 'all');
  v_today date := public.seoul_today();
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if v_status not in ('all', 'pending', 'upcoming', 'used', 'cancelled', 'partial') then
    raise exception 'invalid_status';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 5000 or p_offset is null or p_offset < 0 then
    raise exception 'invalid_range';
  end if;

  return query
  with base as (
    select o.id,
           o.order_no,
           o.status::text as order_status,
           o.booker_name,
           o.total_amount,
           o.refund_amount,
           o.paid_at,
           c.*
    from public.orders o
    cross join lateral (
      select (array_agg(oi.product_title order by oi.use_date, oi.id))[1] as first_title,
             count(*)::integer as item_count,
             (count(*) filter (where oi.status::text = 'pending'))::integer as pending_count,
             (count(*) filter (where oi.status::text = 'confirmed' and oi.use_date >= v_today))::integer
               as upcoming_count,
             (count(*) filter (
               where oi.status::text = 'used' or (oi.status::text = 'confirmed' and oi.use_date < v_today)
             ))::integer as used_count,
             (count(*) filter (where oi.status::text in ('cancelled', 'rejected', 'expired')))::integer
               as closed_count,
             string_agg(distinct pa.name, ', ') as partner_names
      from public.order_items oi
      join public.partners pa on pa.id = oi.partner_id
      where oi.order_id = o.id
    ) c
    where (v_q is null or position(v_q in lower(o.order_no)) > 0 or position(v_q in lower(o.booker_name)) > 0)
      and (p_partner is null or exists (
        select 1 from public.order_items x where x.order_id = o.id and x.partner_id = p_partner
      ))
      and (p_from is null or (o.paid_at at time zone 'Asia/Seoul')::date >= p_from)
      and (p_to is null or (o.paid_at at time zone 'Asia/Seoul')::date <= p_to)
  ), classified as (
    select b.*,
           case
             when b.order_status = 'cancelled' then 'cancelled'
             when b.pending_count > 0 then 'pending'
             when b.upcoming_count > 0 then 'upcoming'
             else 'used'
           end as display_status,
           b.closed_count > 0 and b.closed_count < b.item_count as partial
    from base b
  )
  select k.id, k.order_no, k.display_status, k.partial, k.booker_name, k.total_amount, k.refund_amount,
         k.paid_at, k.first_title, k.item_count, k.pending_count, k.upcoming_count, k.used_count,
         k.closed_count, k.partner_names,
         (count(*) over ())::integer
  from classified k
  where v_status = 'all'
     or (v_status = 'partial' and k.partial)
     or k.display_status = v_status
  order by k.paid_at desc, k.id
  limit p_limit offset p_offset;
end;
$$;
--> statement-breakpoint

-- ─── 2) 권한 ───────────────────────────────────────────────────────────
revoke execute on function public.admin_orders(text, text, uuid, date, date, integer, integer) from public, anon, authenticated;
--> statement-breakpoint
-- 관리자 함수도 authenticated에게 준다: 함수 안에서 is_admin()으로 다시 거른다
grant execute on function public.admin_orders(text, text, uuid, date, date, integer, integer) to authenticated;
