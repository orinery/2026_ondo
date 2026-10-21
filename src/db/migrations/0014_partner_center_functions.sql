-- Custom SQL migration file, put your code below! --
-- 파트너 센터 2/2: 0013(사진·진행 일정 쓰기 정책)에 이어
--   1) Storage: 상품 사진 버킷 (파트너 폴더에만 업로드)
--   2) 상품 저장(save_product): 상품·사진·진행 일정·회차·옵션을 한 트랜잭션으로 (security invoker → RLS 그대로)
--   3) 날짜별 재고 일괄 수정(set_inventory_range)
--   4) 예약 처리: 파트너 예약 목록(예약자 연락처 포함) · 확정 · 거절 · 바우처 사용 처리 · 기한 지난 확정 대기 자동 취소
--   5) pg_cron: 10분마다 자동 취소 (프로젝트가 일시 정지되면 멈추므로 화면을 열 때도 한 번 더 처리한다)
--   6) 권한
--
-- 오류는 `raise exception '<코드>'` → src/lib/order-errors.ts에서 한국어로.

-- ─── 1) Storage: 상품 사진 ──────────────────────────────────────────────
-- 경로 "{partner_id}/{파일}" — 첫 폴더가 내 파트너 id일 때만 올리고 지울 수 있다 (리뷰 사진의 사용자 폴더와 같은 방식)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
--> statement-breakpoint
create policy "product_images_insert_partner" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select public.my_partner_id())::text);
--> statement-breakpoint
create policy "product_images_update_partner" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select public.my_partner_id())::text)
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select public.my_partner_id())::text);
--> statement-breakpoint
create policy "product_images_delete_partner" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select public.my_partner_id())::text);
--> statement-breakpoint

-- ─── 2) 상품 저장 ──────────────────────────────────────────────────────
-- p_product_id가 null이면 새 상품, 있으면 수정. 돌려주는 값 = 상품 id.
-- security invoker: 파트너 권한 그대로 실행 → 남의 상품은 RLS로 0행(not_found), 쓸 수 없는 컬럼은 GRANT로 거부.
-- 여러 테이블을 한 함수(= 한 트랜잭션)로 저장해서, 중간에 실패하면 아무것도 바뀌지 않는다.
-- p_product: products 컬럼 이름의 JSON + publish(boolean). 대표 사진·대표 시작 시간은 사진·회차 첫 번째에서 정한다.
create or replace function public.save_product(
  p_product_id uuid,
  p_product jsonb,
  p_images jsonb,
  p_itinerary jsonb,
  p_slots jsonb,
  p_options jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := p_product_id;
  r public.products;
  v_publish boolean := coalesce((p_product ->> 'publish')::boolean, false);
  v_cover jsonb := p_images -> 0;
  v_first_time time := nullif(p_slots -> 0 ->> 'start_time', '')::time;
begin
  if public.my_partner_id() is null then
    raise exception 'forbidden';
  end if;

  -- 사진: 1~8장, 내 상품 사진 버킷(또는 시드의 Unsplash) 주소만 — 다른 주소는 화면(next/image)에서 거부된다
  if jsonb_typeof(p_images) <> 'array' or jsonb_array_length(p_images) not between 1 and 8
     or exists (
       select 1 from jsonb_array_elements(p_images) x
       where not (
         x ->> 'url' ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/product-images/'
         or x ->> 'url' ~ '^https://images\.unsplash\.com/'
       )
       or char_length(coalesce(x ->> 'alt', '')) not between 1 and 120
     ) then
    raise exception 'invalid_images';
  end if;
  -- 회차: 1~6개, 같은 시간 두 번 불가
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) not between 1 and 6
     or (select count(distinct nullif(x ->> 'start_time', '')) + count(*) filter (where nullif(x ->> 'start_time', '') is null)
         from jsonb_array_elements(p_slots) x) <> jsonb_array_length(p_slots) then
    raise exception 'invalid_slots';
  end if;
  -- 옵션: 0~10개, 같은 이름 두 번 불가
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) > 10
     or (select count(distinct x ->> 'name') from jsonb_array_elements(p_options) x) <> jsonb_array_length(p_options) then
    raise exception 'invalid_options';
  end if;
  if jsonb_typeof(p_itinerary) <> 'array' or jsonb_array_length(p_itinerary) > 15 then
    raise exception 'invalid_itinerary';
  end if;

  r := jsonb_populate_record(null::public.products, p_product);

  if v_id is null then
    -- partner_id는 기본값(my_partner_id())으로 채워진다
    insert into public.products (
      slug, city_id, category, theme, title, summary, description, highlights,
      image_url, image_alt, adult_price, child_price, list_adult_price, operating_days, cutoff_days,
      max_qty, start_time, duration_text, includes, excludes, usage_info, meeting_point,
      latitude, longitude, cancel_policy, unavailable_reason, confirmation_mode, published_at
    )
    values (
      r.slug, r.city_id, r.category, r.theme, r.title, r.summary, r.description, r.highlights,
      v_cover ->> 'url', v_cover ->> 'alt', r.adult_price, r.child_price, r.list_adult_price,
      r.operating_days, r.cutoff_days, r.max_qty, v_first_time, r.duration_text, r.includes,
      r.excludes, r.usage_info, r.meeting_point, r.latitude, r.longitude, r.cancel_policy,
      r.unavailable_reason, r.confirmation_mode, case when v_publish then now() end
    )
    returning id into v_id;
  else
    update public.products p
    set (city_id, category, theme, title, summary, description, highlights,
         image_url, image_alt, adult_price, child_price, list_adult_price, operating_days, cutoff_days,
         max_qty, start_time, duration_text, includes, excludes, usage_info, meeting_point,
         latitude, longitude, cancel_policy, unavailable_reason, confirmation_mode, published_at) =
        (r.city_id, r.category, r.theme, r.title, r.summary, r.description, r.highlights,
         v_cover ->> 'url', v_cover ->> 'alt', r.adult_price, r.child_price, r.list_adult_price,
         r.operating_days, r.cutoff_days, r.max_qty, v_first_time, r.duration_text, r.includes,
         r.excludes, r.usage_info, r.meeting_point, r.latitude, r.longitude, r.cancel_policy,
         r.unavailable_reason, r.confirmation_mode,
         -- 다시 공개해도 처음 공개한 시각은 유지한다
         case when v_publish then coalesce(p.published_at, now()) end)
    where p.id = v_id;
    if not found then
      raise exception 'not_found';
    end if;
  end if;

  -- 사진·진행 일정: 순서가 곧 position이라 지우고 다시 넣는다 (주문이 참조하지 않는 데이터)
  delete from public.product_images where product_id = v_id;
  insert into public.product_images (product_id, url, alt, position)
  select v_id, x ->> 'url', x ->> 'alt', (n - 1)::smallint
  from jsonb_array_elements(p_images) with ordinality as t(x, n);

  delete from public.product_itinerary_items where product_id = v_id;
  insert into public.product_itinerary_items (product_id, position, time, title, note, type, caution)
  select v_id, (n - 1)::smallint, nullif(x ->> 'time', '')::time, x ->> 'title',
         nullif(x ->> 'note', ''), (x ->> 'type')::public.itinerary_item_type, nullif(x ->> 'caution', '')
  from jsonb_array_elements(p_itinerary) with ordinality as t(x, n);

  -- 회차·옵션: 장바구니·주문이 참조하므로 지우지 않는다. 시간(옵션은 이름)으로 upsert하고, 목록에서 빠진 것은 판매만 끈다
  insert into public.product_slots (product_id, start_time, capacity, position, active)
  select v_id, nullif(x ->> 'start_time', '')::time, (x ->> 'capacity')::smallint, (n - 1)::smallint, true
  from jsonb_array_elements(p_slots) with ordinality as t(x, n)
  on conflict (product_id, start_time)
  do update set capacity = excluded.capacity, position = excluded.position, active = true;

  update public.product_slots s
  set active = false
  where s.product_id = v_id
    and s.active
    and not exists (
      select 1 from jsonb_array_elements(p_slots) x
      where nullif(x ->> 'start_time', '')::time is not distinct from s.start_time
    );

  insert into public.product_options (product_id, name, price, unit, position, active)
  select v_id, x ->> 'name', (x ->> 'price')::integer, (x ->> 'unit')::public.option_unit, (n - 1)::smallint, true
  from jsonb_array_elements(p_options) with ordinality as t(x, n)
  on conflict (product_id, name)
  do update set price = excluded.price, unit = excluded.unit, position = excluded.position, active = true;

  update public.product_options o
  set active = false
  where o.product_id = v_id
    and o.active
    and not exists (select 1 from jsonb_array_elements(p_options) x where x ->> 'name' = o.name);

  return v_id;
end;
$$;
--> statement-breakpoint

-- ─── 3) 날짜별 재고 일괄 수정 ────────────────────────────────────────────
-- 기간 × 요일에 정원·마감·가격을 덮어쓴다. 모두 null·closed=false로 보내면 "기본값으로 되돌리기".
-- security invoker: 남의 회차는 RLS로 거부. 예약 인원(booked)은 건드리지 않는다.
-- 정원을 예약보다 적게 만들면 트리거가 capacity_below_booked → 기간 전체가 바뀌지 않는다.
create or replace function public.set_inventory_range(
  p_slot_id uuid,
  p_from date,
  p_to date,
  p_weekdays smallint[],
  p_capacity integer,
  p_closed boolean,
  p_adult_price integer,
  p_child_price integer
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  if public.my_partner_id() is null then
    raise exception 'forbidden';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 180
     or p_from < public.seoul_today() then
    raise exception 'invalid_range';
  end if;
  if not exists (
    select 1 from public.product_slots s
    join public.products p on p.id = s.product_id
    where s.id = p_slot_id and p.partner_id = public.my_partner_id()
  ) then
    raise exception 'not_found';
  end if;

  insert into public.slot_inventory (slot_id, use_date, capacity, closed, adult_price, child_price)
  select p_slot_id, d::date, p_capacity, coalesce(p_closed, false), p_adult_price, p_child_price
  from generate_series(p_from, p_to, interval '1 day') d
  where coalesce(cardinality(p_weekdays), 0) = 0
     or extract(isodow from d)::smallint = any(p_weekdays)
  on conflict (slot_id, use_date)
  do update set capacity = excluded.capacity,
                closed = excluded.closed,
                adult_price = excluded.adult_price,
                child_price = excluded.child_price;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
--> statement-breakpoint

-- ─── 4) 예약 처리 ──────────────────────────────────────────────────────
-- 파트너 예약 목록: 내 상품의 주문 항목 + 주문번호·예약자 연락처.
-- 파트너에게 orders 읽기 권한을 주지 않았으므로(다른 파트너 항목이 섞인 주문의 총액 등) 필요한 열만 이 함수로 준다.
create or replace function public.partner_bookings(p_from date, p_to date)
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
  options text,
  booker_name text,
  booker_phone text,
  booker_email text,
  paid_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select oi.id, o.order_no, oi.product_id, oi.product_title, oi.use_date, oi.start_time,
         oi.adult_qty, oi.child_qty, oi.subtotal, oi.refund_amount, oi.status::text,
         oi.confirm_deadline, oi.voucher_code, oi.reject_reason,
         coalesce((
           select string_agg(case when x.unit::text = 'per_person' then x.name || ' ×' || x.qty else x.name end,
                             ', ' order by x.name)
           from public.order_item_options x
           where x.order_item_id = oi.id
         ), ''),
         o.booker_name, o.booker_phone, o.booker_email, o.paid_at
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.partner_id = public.my_partner_id()
    and oi.use_date between p_from and p_to
    and p_to - p_from <= 366
  order by oi.use_date, oi.start_time nulls first, o.paid_at;
$$;
--> statement-breakpoint

-- 파트너 처리 공통: 내 상품 항목인지 확인하고, 주문 행 → 항목 행 순서로 잠근다 (고객 취소·자동 만료와 같은 순서 → 교착 없음)
-- 돌려주는 값 = 잠근 항목의 상태·처리 기한·금액 (OUT 이름에 o_를 붙여 테이블 컬럼 이름과 겹치지 않게)
create or replace function public.lock_partner_item(
  p_item_id uuid,
  out o_status text,
  out o_deadline timestamptz,
  out o_subtotal integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner uuid := public.my_partner_id();
  v_order uuid;
begin
  if v_partner is null then
    raise exception 'forbidden';
  end if;
  select oi.order_id into v_order
  from public.order_items oi
  where oi.id = p_item_id and oi.partner_id = v_partner;
  if not found then
    raise exception 'not_found';
  end if;

  perform 1 from public.orders o where o.id = v_order for update;
  select oi.status::text, oi.confirm_deadline, oi.subtotal into o_status, o_deadline, o_subtotal
  from public.order_items oi
  where oi.id = p_item_id
  for update;
end;
$$;
--> statement-breakpoint

-- 확정: 확정 대기 → 확정 + 바우처 발급. 기한이 지났으면 확정 대신 자동 취소(전액 환불)하고 'expired'를 돌려준다
-- (오류로 던지면 만료 처리까지 롤백되므로 결과 값으로 알린다)
create or replace function public.confirm_item(p_item_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  select * into v_item from public.lock_partner_item(p_item_id);
  if v_item.o_status <> 'pending' then
    raise exception 'not_pending';
  end if;
  if v_item.o_deadline < now() then
    perform public.release_item(p_item_id, 'expired', v_item.o_subtotal);
    return 'expired';
  end if;

  update public.order_items
  set status = 'confirmed', confirmed_at = now(), voucher_code = public.generate_voucher_code()
  where id = p_item_id;
  return 'confirmed';
end;
$$;
--> statement-breakpoint

-- 거절: 확정 대기 → 거절 + 전액 환불 (사용자 확정). 사유는 고객에게 보인다
create or replace function public.reject_item(p_item_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_item record;
begin
  if char_length(v_reason) not between 1 and 200 then
    raise exception 'invalid_reason';
  end if;
  select * into v_item from public.lock_partner_item(p_item_id);
  if v_item.o_status <> 'pending' then
    raise exception 'not_pending';
  end if;
  perform public.release_item(p_item_id, 'rejected', v_item.o_subtotal, v_reason);
end;
$$;
--> statement-breakpoint

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
  returning oi.id, oi.product_title, oi.use_date, oi.adult_qty + oi.child_qty,
            (select o.booker_name from public.orders o where o.id = oi.order_id);
end;
$$;
--> statement-breakpoint

-- 기한이 지난 확정 대기 → 자동 취소(전액 환불). 돌려주는 값 = 처리한 개수.
-- pg_cron이 10분마다 부르고, 파트너·고객 화면을 열 때도 부른다 (여러 번 불러도 결과가 같다)
create or replace function public.expire_pending_items()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_status text;
  v_count integer := 0;
begin
  for v_row in
    select oi.id, oi.order_id, oi.subtotal
    from public.order_items oi
    where oi.status = 'pending' and oi.confirm_deadline < now()
    order by oi.order_id, oi.id
  loop
    perform 1 from public.orders o where o.id = v_row.order_id for update;
    -- 잠그는 사이 파트너가 확정했을 수 있으니 잠근 뒤 다시 확인한다
    select oi.status::text into v_status from public.order_items oi where oi.id = v_row.id for update;
    if v_status = 'pending' then
      perform public.release_item(v_row.id, 'expired', v_row.subtotal);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
--> statement-breakpoint

-- ─── 5) pg_cron ───────────────────────────────────────────────────────
create extension if not exists pg_cron with schema pg_catalog;
--> statement-breakpoint
-- 같은 이름이면 일정이 갱신된다 (다시 실행해도 작업이 늘지 않음)
select cron.schedule('expire-pending-items', '*/10 * * * *', 'select public.expire_pending_items()');
--> statement-breakpoint

-- ─── 6) 권한 ───────────────────────────────────────────────────────────
-- 사진·진행 일정: 파트너가 save_product로 지우고 다시 넣는다 (어떤 상품인지는 0013 RLS가 정한다)
grant insert (product_id, url, alt, position) on public.product_images to authenticated;
--> statement-breakpoint
grant delete on public.product_images to authenticated;
--> statement-breakpoint
grant insert (product_id, position, time, title, note, type, caution)
  on public.product_itinerary_items to authenticated;
--> statement-breakpoint
grant delete on public.product_itinerary_items to authenticated;
--> statement-breakpoint

revoke execute on function public.save_product(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.set_inventory_range(uuid, date, date, smallint[], integer, boolean, integer, integer) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.partner_bookings(date, date) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.lock_partner_item(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.confirm_item(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.reject_item(uuid, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.mark_used(text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.expire_pending_items() from public, anon, authenticated;
--> statement-breakpoint
-- 파트너 함수도 authenticated에게 준다: 함수 안에서 my_partner_id()로 다시 거른다
grant execute on function public.save_product(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
--> statement-breakpoint
grant execute on function public.set_inventory_range(uuid, date, date, smallint[], integer, boolean, integer, integer) to authenticated;
--> statement-breakpoint
grant execute on function public.partner_bookings(date, date) to authenticated;
--> statement-breakpoint
grant execute on function public.confirm_item(uuid) to authenticated;
--> statement-breakpoint
grant execute on function public.reject_item(uuid, text) to authenticated;
--> statement-breakpoint
grant execute on function public.mark_used(text) to authenticated;
--> statement-breakpoint
-- 기한이 지난 것만 처리하는 멱등 함수라 로그인 사용자 누구나 불러도 안전하다 (화면을 열 때의 보완 경로)
grant execute on function public.expire_pending_items() to authenticated;
