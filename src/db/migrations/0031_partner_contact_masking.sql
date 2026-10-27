-- Custom SQL migration file, put your code below! --
-- 파트너에게 보이는 예약자 연락처 가리기 (A-06, 사용자 확정)
--   1) 가리기 헬퍼 (이름 · 전화 · 이메일)
--   2) partner_bookings 교체: 원문은 "살아 있는 예약(확정 대기·확정·이용 완료) + 이용일 7일 뒤까지"만,
--      그 밖(지난 예약 · 취소 · 거절 · 만료)은 가린 값. 조회는 오늘 기준 90일 전 이용분부터.
--      운영자 취소 사유도 함께 돌려준다 (파트너 예약 목록에 표시)
--   3) 권한

-- ─── 1) 가리기 헬퍼 ───────────────────────────────────────────────────────
-- 김여운 → 김*운, 이하 → 이*, 박 → *
create or replace function public.mask_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when char_length(p_name) <= 1 then '*'
    when char_length(p_name) = 2 then left(p_name, 1) || '*'
    else left(p_name, 1) || repeat('*', char_length(p_name) - 2) || right(p_name, 1)
  end;
$$;
--> statement-breakpoint
-- 010-1234-5678 → 010-****-5678 (가운데 자리만)
create or replace function public.mask_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(p_phone, '^(\d{3})-\d{3,4}-(\d{4})$', '\1-****-\2');
$$;
--> statement-breakpoint
-- yeoun@example.com → y***@example.com
create or replace function public.mask_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(p_email, 1) || '***' || substr(p_email, strpos(p_email, '@'));
$$;
--> statement-breakpoint

-- ─── 2) partner_bookings ──────────────────────────────────────────────────
-- 반환 열이 늘어(contact_masked · cancel_reason) 지우고 다시 만든다
drop function public.partner_bookings(date, date);
--> statement-breakpoint
-- 파트너 예약 목록: 내 상품의 주문 항목 + 주문번호·예약자 연락처.
-- 파트너에게 orders 읽기 권한을 주지 않았으므로(다른 파트너 항목이 섞인 주문의 총액 등) 필요한 열만 이 함수로 준다.
-- 연락처 원문은 현장 연락·사후 문의에 필요한 기간만 (예약이 살아 있고 이용일 + 7일 이내). 그 뒤는 가린 값
create function public.partner_bookings(p_from date, p_to date)
returns table (
  item_id uuid,
  order_no text,
  product_id uuid,
  product_title text,
  use_date date,
  start_time time,
  adult_qty smallint,
  child_qty smallint,
  subtotal integer,
  refund_amount integer,
  status text,
  confirm_deadline timestamptz,
  voucher_code text,
  reject_reason text,
  cancel_reason text,
  options text,
  booker_name text,
  booker_phone text,
  booker_email text,
  contact_masked boolean,
  paid_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366
     or p_from < public.seoul_today() - 90 then
    raise exception 'invalid_range';
  end if;

  return query
  select oi.id, o.order_no, oi.product_id, oi.product_title, oi.use_date, oi.start_time,
         oi.adult_qty, oi.child_qty, oi.subtotal, oi.refund_amount, oi.status::text,
         oi.confirm_deadline, oi.voucher_code, oi.reject_reason, oi.cancel_reason,
         coalesce((
           select string_agg(case when x.unit::text = 'per_person' then x.name || ' ×' || x.qty else x.name end,
                             ', ' order by x.name)
           from public.order_item_options x
           where x.order_item_id = oi.id
         ), ''),
         case when v.show_raw then o.booker_name else public.mask_name(o.booker_name) end,
         case when v.show_raw then o.booker_phone else public.mask_phone(o.booker_phone) end,
         case when v.show_raw then o.booker_email else public.mask_email(o.booker_email) end,
         not v.show_raw,
         o.paid_at
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  cross join lateral (
    select oi.status::text in ('pending', 'confirmed', 'used')
           and oi.use_date + 7 >= public.seoul_today() as show_raw
  ) v
  where oi.partner_id = public.my_partner_id()
    and oi.use_date between p_from and p_to
  order by oi.use_date, oi.start_time nulls first, o.paid_at;
end;
$$;
--> statement-breakpoint

-- ─── 3) 권한 ───────────────────────────────────────────────────────────
-- 가리기 헬퍼는 partner_bookings 안에서만 쓴다
revoke execute on function public.mask_name(text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.mask_phone(text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.mask_email(text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.partner_bookings(date, date) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.partner_bookings(date, date) to authenticated;
