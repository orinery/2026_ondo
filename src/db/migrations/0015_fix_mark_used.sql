-- Custom SQL migration file, put your code below! --
-- mark_used 수정: 인원(smallint + smallint = smallint)을 반환 열(integer)에 맞게 변환
-- (0014 적용 후 RLS 검증에서 "structure of query does not match function result type"로 발견)
-- 바우처 사용 처리: 코드(대소문자·공백·하이픈 무시)로 내 상품의 확정 예약을 찾아 "이용 완료"로.
-- 남의 상품 코드는 없는 코드와 같은 오류 (다른 파트너 예약 존재 여부를 알 수 없게)
create or replace function public.mark_used(p_code text)
returns table (item_id uuid, product_title text, use_date date, people integer, booker_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner uuid := public.my_partner_id();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
  v_item record;
begin
  if v_partner is null then
    raise exception 'forbidden';
  end if;

  select oi.id, oi.order_id, oi.status::text as status, oi.use_date into v_item
  from public.order_items oi
  where oi.voucher_code = v_code and oi.partner_id = v_partner;
  if not found then
    raise exception 'voucher_not_found';
  end if;

  perform 1 from public.orders o where o.id = v_item.order_id for update;
  select oi.status::text as status, oi.use_date into v_item
  from public.order_items oi where oi.id = v_item.id for update;

  if v_item.status = 'used' then
    raise exception 'already_used';
  end if;
  if v_item.status <> 'confirmed' then
    raise exception 'voucher_cancelled';
  end if;
  if v_item.use_date > public.seoul_today() then
    raise exception 'not_use_date';
  end if;

  return query
  update public.order_items oi
  set status = 'used', used_at = now()
  where oi.voucher_code = v_code
  returning oi.id, oi.product_title, oi.use_date, (oi.adult_qty + oi.child_qty)::integer,
            (select o.booker_name from public.orders o where o.id = oi.order_id);
end;
$$;
