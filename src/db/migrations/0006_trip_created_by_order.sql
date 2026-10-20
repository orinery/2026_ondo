-- 주문 취소 후 자동 생성 여행이 비어 남던 문제 수정 (사용자 피드백)
-- 1) trips.created_by_order_id: place_order가 만든 여행에 주문 id를 기록 (사용자 GRANT 없음 → 입력 불가)
-- 2) place_order: 여행을 만들 때 created_by_order_id 기록
-- 3) cancel_order: 예약 항목을 지운 뒤, 이 주문이 만든 여행이 비었으면 여행도 삭제
-- 함수는 create or replace라 기존 실행 권한(GRANT)이 그대로 유지된다.
ALTER TABLE "trips" ADD COLUMN "created_by_order_id" uuid;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_created_by_order_id_orders_id_fk" FOREIGN KEY ("created_by_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
  v_day integer;
  v_position integer;
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

    v_day := v_line.use_date - v_trip.start_date;
    select coalesce(max(ti.position) + 1, 0) into v_position
    from public.trip_items ti
    where ti.trip_id = v_trip.id and ti.day_index = v_day;

    insert into public.trip_items (
      trip_id, day_index, position, title, time, type, note, product_id, order_item_id
    )
    values (
      v_trip.id, v_day, v_position, left(v_line.product_title, 60), v_line.start_time,
      'booking', '예약번호 ' || v_order_no, v_line.product_id, v_line.id
    );
  end loop;

  return v_order_no;
end;
$$;
--> statement-breakpoint
create or replace function public.cancel_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_status public.order_status;
  v_refund integer;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;

  -- 같은 주문을 두 번 동시에 취소하지 못하게 행을 잠근다
  select o.status into v_status
  from public.orders o
  where o.id = p_order_id and o.user_id = v_user
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_status = 'cancelled' then
    raise exception 'already_cancelled';
  end if;
  -- 이용일 당일·이후에는 취소할 수 없다 (항목 중 하나라도)
  if exists (
    select 1 from public.order_items oi
    where oi.order_id = p_order_id and oi.use_date <= public.seoul_today()
  ) then
    raise exception 'not_cancellable';
  end if;

  update public.order_items oi
  set refund_amount = q.refund_amount
  from public.refund_quote(p_order_id) q
  where oi.id = q.order_item_id;

  select coalesce(sum(oi.refund_amount), 0) into v_refund
  from public.order_items oi
  where oi.order_id = p_order_id;

  update public.orders o
  set status = 'cancelled', refund_amount = v_refund, cancelled_at = now()
  where o.id = p_order_id;

  -- 플래너의 예약 항목도 함께 지운다 (여행 자체와 다른 일정은 남긴다)
  delete from public.trip_items ti
  where ti.order_item_id in (select oi.id from public.order_items oi where oi.order_id = p_order_id);

  -- 이 주문이 자동으로 만든 여행이 비었으면 함께 지운다.
  -- 사용자가 직접 만든 여행, 다른 일정을 추가한 여행은 남긴다 (사용자 피드백: 빈 여행·날짜가 남던 문제)
  delete from public.trips t
  where t.created_by_order_id = p_order_id
    and not exists (select 1 from public.trip_items ti where ti.trip_id = t.id);

  return v_refund;
end;
$$;
