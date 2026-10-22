-- Custom SQL migration file, put your code below! --
-- 취소 규정 스냅숏 2/2: 0028(order_items.cancel_tiers)에 이어
--   환불 계산(refund_quote)이 규정 테이블 대신 주문 항목에 복사해 둔 구간을 읽는다.
--   → 나중에 규정을 고쳐도 이미 결제한 주문은 결제할 때 동의한 구간대로 환불된다 (A-03)
--   고객 취소·운영자 취소(고객 요청 대행)·취소 확인 창이 모두 이 함수를 쓴다.

-- 취소할 수 있는 항목(확정 대기·확정)만, 확정 대기는 항상 100% (사용자 확정), 확정은 저장된 구간
create or replace function public.refund_quote(p_order_id uuid)
returns table (
  order_item_id uuid,
  status text,
  days_before integer,
  refund_rate integer,
  refund_amount integer
)
language sql
stable
set search_path = ''
as $$
  select oi.id,
         oi.status::text,
         oi.use_date - public.seoul_today(),
         r.rate,
         floor(oi.subtotal * r.rate / 100.0)::integer
  from public.order_items oi
  cross join lateral (
    select case
      when oi.status::text = 'pending' then 100
      else coalesce((
        select (t ->> 'refund_rate')::integer
        from jsonb_array_elements(oi.cancel_tiers) t
        where (t ->> 'days_before')::integer <= oi.use_date - public.seoul_today()
        order by (t ->> 'days_before')::integer desc
        limit 1
      ), 0)
    end as rate
  ) r
  where oi.order_id = p_order_id
    and oi.status::text in ('pending', 'confirmed')
  order by oi.use_date, oi.id;
$$;
