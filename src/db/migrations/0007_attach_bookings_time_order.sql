-- Custom SQL migration file, put your code below! --
-- 플래너 예약 항목 개선 (사용자 피드백)
--   1) 예약 항목을 그날 일정의 "시작 시간 순" 자리에 넣는다 (전에는 맨 끝)
--   2) 여행을 만들거나 기간을 바꾸면, 그 기간에 이용일이 있는데 플래너에 없는 예약을 붙인다
--      (예: 자동 생성 여행을 지운 뒤 새 여행을 만들면 예약이 다시 들어온다)
-- 예약 항목 삽입을 add_booking_to_trip 하나로 모아 place_order와 attach_bookings가 같이 쓴다.

-- ─── 예약 항목 1개를 여행에 넣기 (내부 전용 — 사용자 실행 권한 없음) ─────────────
create or replace function public.add_booking_to_trip(p_trip_id uuid, p_order_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_end date;
  v_item record;
  v_day integer;
  v_position integer;
begin
  select t.start_date, t.end_date into v_start, v_end from public.trips t where t.id = p_trip_id;
  select oi.use_date, oi.product_title, oi.product_id, p.start_time, o.order_no
  into v_item
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
  where oi.id = p_order_item_id;

  -- 여행 기간 밖이면 넣지 않는다 (호출하는 쪽이 걸러 주지만 한 번 더 확인)
  if v_start is null or v_item.use_date is null or v_item.use_date not between v_start and v_end then
    return;
  end if;
  v_day := v_item.use_date - v_start;

  -- 자리: 그날 항목 중 시작 시간이 더 늦은 첫 항목 앞. 시간이 없는 상품이거나 더 늦은 항목이 없으면 맨 끝.
  -- (시간이 없는 항목은 비교하지 않고 사용자가 둔 자리를 존중한다)
  v_position := null;
  if v_item.start_time is not null then
    select ti.position into v_position
    from public.trip_items ti
    where ti.trip_id = p_trip_id and ti.day_index = v_day and ti.time > v_item.start_time
    order by ti.position
    limit 1;
  end if;

  if v_position is null then
    select coalesce(max(ti.position) + 1, 0) into v_position
    from public.trip_items ti
    where ti.trip_id = p_trip_id and ti.day_index = v_day;
  else
    update public.trip_items ti
    set position = ti.position + 1
    where ti.trip_id = p_trip_id and ti.day_index = v_day and ti.position >= v_position;
  end if;

  insert into public.trip_items (
    trip_id, day_index, position, title, time, type, note, product_id, order_item_id
  )
  values (
    p_trip_id, v_day, v_position, left(v_item.product_title, 60), v_item.start_time,
    'booking', '예약번호 ' || v_item.order_no, v_item.product_id, p_order_item_id
  );
end;
$$;
--> statement-breakpoint

-- ─── 여행 기간 안의 "플래너에 없는 예약"을 붙이기 (여행 생성·기간 변경 후 호출) ──────
-- 돌려주는 값 = 붙인 개수. 남의 여행 id는 not_found (존재 여부를 알 수 없게)
create or replace function public.attach_bookings(p_trip_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_start date;
  v_end date;
  v_count integer := 0;
  v_row record;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;

  select t.start_date, t.end_date into v_start, v_end
  from public.trips t
  where t.id = p_trip_id and t.user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  for v_row in
    select oi.id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.user_id = v_user
      and o.status = 'paid'
      and oi.use_date between v_start and v_end
      and not exists (select 1 from public.trip_items ti where ti.order_item_id = oi.id)
    order by oi.use_date, oi.id
  loop
    perform public.add_booking_to_trip(p_trip_id, v_row.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
--> statement-breakpoint

-- ─── place_order: 예약 항목 삽입을 add_booking_to_trip으로 (시작 시간 순) ─────────
create or replace function public.place_order(
  p_cart_item_ids uuid[],
  p_booker_name text,
  p_booker_email text,
  p_booker_phone text,
  p_policy_agreed boolean,
  p_expected_total integer,
  p_idempotency_key uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order_no text;
  v_order_id uuid;
  v_requested integer;
  v_locked integer;
  v_total integer := 0;
  v_error text;
  v_line record;
  v_trip record;
  v_created_trips uuid[] := '{}';
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;
  if p_idempotency_key is null then
    raise exception 'invalid';
  end if;

  -- ① 같은 결제 요청(두 번 클릭·네트워크 재시도)이 이미 처리됐으면 그 주문번호를 그대로 돌려준다
  select o.order_no into v_order_no
  from public.orders o
  where o.user_id = v_user and o.idempotency_key = p_idempotency_key;
  if found then
    return v_order_no;
  end if;

  if p_policy_agreed is not true then
    raise exception 'policy_not_agreed';
  end if;

  select count(distinct x) into v_requested from unnest(p_cart_item_ids) as x;
  if v_requested = 0 or v_requested > 20 then
    raise exception 'invalid';
  end if;

  -- ② 본인 장바구니 행을 잠근다. 다른 탭에서 같은 항목으로 동시에 결제하면 한쪽은 여기서 기다렸다가
  --    행이 이미 지워진 것을 보고 멈춘다 → 같은 항목으로 주문이 두 번 생기지 않는다.
  with locked as (
    select c.id
    from public.cart_items c
    where c.id = any(p_cart_item_ids) and c.user_id = v_user
    for update
  )
  select count(*) into v_locked from locked;

  if v_locked <> v_requested then
    -- 같은 키의 요청이 방금 끝났다면 그 주문을 돌려준다
    select o.order_no into v_order_no
    from public.orders o
    where o.user_id = v_user and o.idempotency_key = p_idempotency_key;
    if found then
      return v_order_no;
    end if;
    raise exception 'cart_changed';
  end if;

  -- ③ 예약 조건 재검사 + 현재 가격으로 금액 계산
  for v_line in
    select c.product_id, c.use_date, c.adult_qty, c.child_qty, p.adult_price, p.child_price
    from public.cart_items c
    join public.products p on p.id = c.product_id
    where c.id = any(p_cart_item_ids)
  loop
    v_error := public.booking_error(v_line.product_id, v_line.use_date, v_line.adult_qty, v_line.child_qty);
    if v_error is not null then
      raise exception '%', v_error;
    end if;
    v_total := v_total + v_line.adult_qty * v_line.adult_price
                       + v_line.child_qty * coalesce(v_line.child_price, 0);
  end loop;

  -- 화면에 보인 금액과 다르면(그 사이 가격 변경) 결제하지 않고 다시 확인하게 한다
  if v_total <> p_expected_total then
    raise exception 'price_changed';
  end if;

  -- ④ 주문 생성
  v_order_no := 'YO' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-'
                || lpad(nextval('public.order_no_seq')::text, 6, '0');

  insert into public.orders (
    order_no, user_id, booker_name, booker_email, booker_phone,
    total_amount, idempotency_key, policy_agreed_at
  )
  values (
    v_order_no, v_user, trim(p_booker_name), lower(trim(p_booker_email)), p_booker_phone,
    v_total, p_idempotency_key, now()
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_title, use_date, adult_qty, child_qty,
    adult_price, child_price, subtotal, cancel_policy
  )
  select v_order_id, p.id, p.title, c.use_date, c.adult_qty, c.child_qty,
         p.adult_price, p.child_price,
         c.adult_qty * p.adult_price + c.child_qty * coalesce(p.child_price, 0),
         p.cancel_policy
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.id = any(p_cart_item_ids);

  delete from public.cart_items c where c.id = any(p_cart_item_ids);

  -- ⑤ 플래너 연결: 이용일을 포함하는 내 여행에 "예약" 항목으로 넣는다.
  --    맞는 여행이 없으면 "{도시} 여행"을 만들고, 같은 주문의 다음 날짜는 그 여행을 늘려 담는다(최대 30일).
  for v_line in
    select oi.id, oi.product_id, oi.product_title, oi.use_date, p.start_time, ci.name as city_name
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.cities ci on ci.id = p.city_id
    where oi.order_id = v_order_id
    order by oi.use_date, oi.id
  loop
    select t.id, t.start_date into v_trip
    from public.trips t
    where t.user_id = v_user and v_line.use_date between t.start_date and t.end_date
    order by t.created_at desc
    limit 1;

    if not found then
      select t.id, t.start_date into v_trip
      from public.trips t
      where t.id = any(v_created_trips) and v_line.use_date - t.start_date <= 29
      order by t.start_date desc
      limit 1;

      if found then
        -- 다른 도시가 섞이면 제목을 "일본 여행"으로 바꾼다
        update public.trips t
        set end_date = v_line.use_date,
            title = case when t.title = v_line.city_name || ' 여행' then t.title else '일본 여행' end
        where t.id = v_trip.id;
      else
        -- created_by_order_id: 이 주문이 만든 여행임을 기록 → 주문을 취소해 비면 함께 지운다
        insert into public.trips (user_id, title, start_date, end_date, created_by_order_id)
        values (v_user, v_line.city_name || ' 여행', v_line.use_date, v_line.use_date, v_order_id)
        returning id, start_date into v_trip;
        v_created_trips := v_created_trips || v_trip.id;
      end if;
    end if;

    -- 시작 시간 순 자리에 예약 항목을 넣는다 (0007: 공통 함수로 분리)
    perform public.add_booking_to_trip(v_trip.id, v_line.id);
  end loop;

  return v_order_no;
end;
$$;
--> statement-breakpoint
revoke execute on function public.add_booking_to_trip(uuid, uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.attach_bookings(uuid) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.attach_bookings(uuid) to authenticated;
