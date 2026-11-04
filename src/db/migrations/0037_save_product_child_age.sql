-- Custom SQL migration file, put your code below! --
-- 아동 기준 2/2: 0036(products.child_age_label)에 이어 (Quick Win Q2)
--   파트너가 상품 폼에서 아동 기준을 저장할 수 있게 컬럼 권한을 주고 save_product가 함께 저장한다.
--   save_product는 상품 값을 jsonb로 받으므로 인자(시그니처)는 그대로 — 옛 앱은 이 값을 안 보내 null로 저장된다.
--   본문은 0014와 같고 insert·update 컬럼 목록에 child_age_label만 더했다.

-- ─── 1) 권한: 파트너가 쓰는 "내용" 컬럼에 추가 (0010과 같은 방식) ─────────────────
grant insert (child_age_label) on public.products to authenticated;
--> statement-breakpoint
grant update (child_age_label) on public.products to authenticated;
--> statement-breakpoint

-- ─── 2) 상품 저장 ──────────────────────────────────────────────────────
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
      image_url, image_alt, adult_price, child_price, child_age_label, list_adult_price, operating_days,
      cutoff_days, max_qty, start_time, duration_text, includes, excludes, usage_info, meeting_point,
      latitude, longitude, cancel_policy, unavailable_reason, confirmation_mode, published_at
    )
    values (
      r.slug, r.city_id, r.category, r.theme, r.title, r.summary, r.description, r.highlights,
      v_cover ->> 'url', v_cover ->> 'alt', r.adult_price, r.child_price, r.child_age_label,
      r.list_adult_price, r.operating_days, r.cutoff_days, r.max_qty, v_first_time, r.duration_text,
      r.includes, r.excludes, r.usage_info, r.meeting_point, r.latitude, r.longitude, r.cancel_policy,
      r.unavailable_reason, r.confirmation_mode, case when v_publish then now() end
    )
    returning id into v_id;
  else
    update public.products p
    set (city_id, category, theme, title, summary, description, highlights,
         image_url, image_alt, adult_price, child_price, child_age_label, list_adult_price, operating_days,
         cutoff_days, max_qty, start_time, duration_text, includes, excludes, usage_info, meeting_point,
         latitude, longitude, cancel_policy, unavailable_reason, confirmation_mode, published_at) =
        (r.city_id, r.category, r.theme, r.title, r.summary, r.description, r.highlights,
         v_cover ->> 'url', v_cover ->> 'alt', r.adult_price, r.child_price, r.child_age_label,
         r.list_adult_price, r.operating_days, r.cutoff_days, r.max_qty, v_first_time, r.duration_text,
         r.includes, r.excludes, r.usage_info, r.meeting_point, r.latitude, r.longitude, r.cancel_policy,
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
