-- Custom SQL migration file, put your code below! --
-- 쇼핑몰 전환 3/3: 0004(Drizzle 자동 생성)에서 표현할 수 없는 것들
--   1) 예약 규칙 함수(booking_error)와 장바구니 검증 트리거
--   2) 리뷰 자격(has_used_product) + 리뷰 작성 정책 변경, 상품 평점 캐시 트리거
--   3) 환불 계산(refund_quote) · 주문(place_order) · 주문 취소(cancel_order)
--   4) 예약 항목 보호 트리거 (플래너)
--   5) 새 테이블·컬럼 권한(GRANT)과 함수 실행 권한
--
-- 오류는 `raise exception '<코드>'`로 던진다. 앱은 메시지(코드)를 src/lib/order-errors.ts에서 한국어로 바꾼다.
-- security definer 함수는 search_path = ''와 스키마를 붙인 이름만 쓴다 (0001과 같은 이유).

-- ─── 1) 날짜·예약 규칙 ───────────────────────────────────────────────────
-- 이용일은 한국(=일본, 둘 다 UTC+9) 날짜 기준이다. DB 서버 시간대(UTC)와 상관없이 같은 "오늘"을 쓴다.
create or replace function public.seoul_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;
--> statement-breakpoint

-- 예약할 수 없으면 이유 코드를, 가능하면 null을 돌려준다.
-- 장바구니 트리거와 place_order가 같은 함수를 써서 "담을 때"와 "결제할 때"의 규칙이 어긋나지 않게 한다.
-- 화면용 같은 규칙은 src/lib/booking.ts에 있다 (날짜 비활성 표시용 — 최종 판단은 항상 이 함수).
create or replace function public.booking_error(
  p_product_id uuid,
  p_use_date date,
  p_adult integer,
  p_child integer
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_product record;
  v_days integer := p_use_date - public.seoul_today();
begin
  select p.unavailable_reason, p.child_price, p.operating_days, p.cutoff_days, p.max_qty
  into v_product
  from public.products p
  where p.id = p_product_id;

  if not found then
    return 'product_not_found';
  end if;
  if v_product.unavailable_reason is not null then
    return 'unavailable';
  end if;
  if p_adult < 0 or p_child < 0 or p_adult + p_child < 1 or p_adult + p_child > v_product.max_qty then
    return 'qty';
  end if;
  if p_child > 0 and v_product.child_price is null then
    return 'child_unavailable';
  end if;
  -- 지난 날짜도 여기서 걸린다 (cutoff_days >= 0)
  if v_days < v_product.cutoff_days then
    return 'cutoff';
  end if;
  if v_days > 180 then
    return 'too_far';
  end if;
  if not (extract(isodow from p_use_date)::smallint = any(v_product.operating_days)) then
    return 'closed_day';
  end if;
  return null;
end;
$$;
--> statement-breakpoint

create or replace function public.validate_cart_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_error text := public.booking_error(new.product_id, new.use_date, new.adult_qty, new.child_qty);
begin
  if v_error is not null then
    raise exception '%', v_error;
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger cart_items_validate
  before insert or update of product_id, use_date, adult_qty, child_qty on public.cart_items
  for each row execute function public.validate_cart_item();
--> statement-breakpoint
create trigger cart_items_set_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();
--> statement-breakpoint

-- ─── 2) 리뷰: 구매 인증 + 평점 캐시 ───────────────────────────────────────
-- 이용일이 지났고 취소되지 않은 주문에 이 상품이 있으면 true.
-- security invoker: 호출한 사용자 권한으로 실행되므로 orders RLS(본인 것만)가 그대로 적용된다.
create or replace function public.has_used_product(p_product_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.user_id = (select auth.uid())
      and o.status = 'paid'
      and oi.product_id = p_product_id
      and oi.use_date < public.seoul_today()
  );
$$;
--> statement-breakpoint
-- 0004에서 옮겨 온 정책 변경 (함수가 먼저 있어야 한다)
ALTER POLICY "reviews_insert_own" ON "reviews" TO authenticated WITH CHECK ("reviews"."user_id" = (select auth.uid()) and public.has_used_product("reviews"."product_id"));
--> statement-breakpoint

-- 사용자는 products를 수정할 권한이 없으므로 security definer로 갱신한다 (0001의 여행지 버전과 같은 구조)
create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set rating_avg = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.product_id = target), 0),
      review_count = (select count(*) from public.reviews r where r.product_id = target)
  where p.id = target;
  return null;
end;
$$;
--> statement-breakpoint
create trigger reviews_refresh_rating after insert or update of rating or delete on public.reviews
  for each row execute function public.refresh_product_rating();
--> statement-breakpoint

-- ─── 3) 환불 계산 · 주문 · 취소 ─────────────────────────────────────────
-- 항목별 남은 일수 → 취소 규정 구간 → 환불률·환불액(원 단위 내림).
-- 취소 확인 창(미리 보기)과 cancel_order가 같은 함수를 써서 보여준 금액과 실제 환불액이 같다.
create or replace function public.refund_quote(p_order_id uuid)
returns table (order_item_id uuid, days_before integer, refund_rate integer, refund_amount integer)
language sql
stable
set search_path = ''
as $$
  select oi.id,
         oi.use_date - public.seoul_today(),
         r.rate,
         floor(oi.subtotal * r.rate / 100.0)::integer
  from public.order_items oi
  cross join lateral (
    select coalesce((
      select t.refund_rate::integer
      from public.cancellation_policy_tiers t
      where t.policy_code = oi.cancel_policy
        and t.days_before <= oi.use_date - public.seoul_today()
      order by t.days_before desc
      limit 1
    ), 0) as rate
  ) r
  where oi.order_id = p_order_id
  order by oi.use_date, oi.id;
$$;
--> statement-breakpoint

create sequence public.order_no_seq;
--> statement-breakpoint

-- 장바구니 항목으로 주문을 만든다 (모의 결제 — 실제 결제사 호출 없음).
--
-- 왜 security definer 함수인가
-- - orders·order_items에는 INSERT 권한이 없다. 클라이언트가 금액을 넣을 수 있으면 위조할 수 있기 때문이다.
--   이 함수만 주문을 만들 수 있고, 금액은 products의 현재 가격으로 여기서 계산한다.
-- - 클라이언트가 보내는 것은 장바구니 항목 id·예약자 정보·화면에 보인 총액·중복 방지 키뿐이다.
-- - 함수 하나 = 트랜잭션 하나: 주문 생성 · 장바구니 삭제 · 일정 추가가 전부 되거나 전부 안 된다.
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
        insert into public.trips (user_id, title, start_date, end_date)
        values (v_user, v_line.city_name || ' 여행', v_line.use_date, v_line.use_date)
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

-- 주문 전체를 취소한다 (모의 환불). 돌려주는 값 = 환불 총액.
-- 남의 주문 id는 "없는 주문"과 같은 오류(not_found)를 돌려줘 존재 여부를 알 수 없게 한다.
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

  return v_refund;
end;
$$;
--> statement-breakpoint

-- ─── 4) 플래너의 예약 항목 보호 ──────────────────────────────────────────
-- 예약 항목의 날짜는 주문 이용일에서 정해진다. 사용자가 다른 날로 옮기거나 상품·유형을 바꾸면 거부한다.
-- (시간·메모·제목은 고칠 수 있다.) pg_trigger_depth() = 1: 사용자가 직접 한 수정만 막고,
-- 아래 여행 날짜 변경 트리거가 하는 재계산(깊이 2)은 허용한다.
create or replace function public.guard_booking_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 1 and old.order_item_id is not null and (
       new.day_index is distinct from old.day_index
    or new.product_id is distinct from old.product_id
    or new.type is distinct from old.type
  ) then
    raise exception 'booking_locked';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger trip_items_guard_booking before update on public.trip_items
  for each row execute function public.guard_booking_item();
--> statement-breakpoint

-- 여행 날짜를 바꾸면 예약 항목의 Day를 이용일에 맞춰 다시 계산한다.
-- 새 기간이 예약 이용일을 벗어나면 거부한다 (예약을 먼저 취소해야 한다).
create or replace function public.sync_booking_days()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.trip_items ti
    join public.order_items oi on oi.id = ti.order_item_id
    where ti.trip_id = new.id
      and oi.use_date not between new.start_date and new.end_date
  ) then
    raise exception 'booking_out_of_range';
  end if;

  update public.trip_items ti
  set day_index = oi.use_date - new.start_date
  from public.order_items oi
  where ti.trip_id = new.id
    and oi.id = ti.order_item_id
    and ti.day_index <> oi.use_date - new.start_date;
  return null;
end;
$$;
--> statement-breakpoint
create trigger trips_sync_booking_days after update of start_date, end_date on public.trips
  for each row execute function public.sync_booking_days();
--> statement-breakpoint

-- ─── 5) 권한 ───────────────────────────────────────────────────────────
-- Supabase는 새 테이블·함수·시퀀스에 anon/authenticated 권한을 기본으로 준다. 0001처럼 모두 회수한 뒤 필요한 것만 준다.
revoke all on public.cities, public.cancellation_policies, public.cancellation_policy_tiers,
  public.products, public.product_images, public.product_itinerary_items,
  public.cart_items, public.orders, public.order_items from anon, authenticated;
--> statement-breakpoint
revoke all on sequence public.order_no_seq from public, anon, authenticated;
--> statement-breakpoint

-- 공개 읽기
grant select on public.cities, public.cancellation_policies, public.cancellation_policy_tiers,
  public.products, public.product_images, public.product_itinerary_items to anon, authenticated;
--> statement-breakpoint

-- 장바구니: 상품·날짜·수량만 쓸 수 있다 (user_id는 기본값 auth.uid(), 가격 컬럼은 없다)
grant select, delete on public.cart_items to authenticated;
--> statement-breakpoint
grant insert (product_id, use_date, adult_qty, child_qty) on public.cart_items to authenticated;
--> statement-breakpoint
grant update (use_date, adult_qty, child_qty) on public.cart_items to authenticated;
--> statement-breakpoint

-- 주문: 읽기만 (만들기·취소는 함수로)
grant select on public.orders, public.order_items to authenticated;
--> statement-breakpoint

-- 0003에서 지운 destination_id 대신 product_id 권한 (나머지 컬럼 권한은 0001 그대로)
grant insert (product_id) on public.likes to authenticated;
--> statement-breakpoint
grant insert (product_id) on public.reviews to authenticated;
--> statement-breakpoint
-- trip_items.order_item_id에는 권한을 주지 않는다 → 사용자는 예약 항목을 만들 수 없다
grant insert (product_id) on public.trip_items to authenticated;
--> statement-breakpoint
grant update (product_id) on public.trip_items to authenticated;
--> statement-breakpoint

-- 함수 실행 권한: 기본(public) 권한을 모두 회수한 뒤 로그인 사용자에게 필요한 것만 준다.
-- 트리거 전용 함수는 아무에게도 주지 않는다 (트리거 실행에는 EXECUTE 권한이 필요 없다).
revoke execute on function public.seoul_today() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.booking_error(uuid, date, integer, integer) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.has_used_product(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.refund_quote(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.place_order(uuid[], text, text, text, boolean, integer, uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.cancel_order(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.validate_cart_item() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.refresh_product_rating() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.guard_booking_item() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.sync_booking_days() from public, anon, authenticated;
--> statement-breakpoint
-- 장바구니 트리거·리뷰 정책이 사용자 권한으로 호출하므로 seoul_today·booking_error·has_used_product도 필요하다
grant execute on function public.seoul_today() to authenticated;
--> statement-breakpoint
grant execute on function public.booking_error(uuid, date, integer, integer) to authenticated;
--> statement-breakpoint
grant execute on function public.has_used_product(uuid) to authenticated;
--> statement-breakpoint
grant execute on function public.refund_quote(uuid) to authenticated;
--> statement-breakpoint
grant execute on function public.place_order(uuid[], text, text, text, boolean, integer, uuid) to authenticated;
--> statement-breakpoint
grant execute on function public.cancel_order(uuid) to authenticated;
