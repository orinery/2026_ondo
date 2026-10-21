-- Custom SQL migration file, put your code below! --
-- 회차 재고·옵션·항목 상태 2/2: 0011(Drizzle 자동 생성)에서 표현할 수 없는 것들
--   1) 기존 데이터 이전: 상품마다 기본 회차, 장바구니·주문 항목에 회차·파트너·상태, 예약 인원 카운터
--   2) 예약 규칙(booking_error)·금액 계산(line_price)·장바구니 트리거에 회차·옵션·잔여석 반영
--   3) 주문(place_order): 좌석을 원자적으로 확보(초과 판매 방지), 옵션 금액, 확정 대기·바우처
--   4) 항목 단위 취소(cancel_order_item)와 공통 해제(release_item), 환불 계산·리뷰 자격·플래너 연결 수정
--   5) 권한
--
-- 핵심 불변식: slot_inventory.booked = 그 날짜·회차의 "살아 있는"(pending·confirmed·used) 항목 인원 합.
-- booked를 바꾸는 곳은 place_order(증가)와 release_item(감소) 두 곳뿐이다.

-- ─── 1) 기존 데이터 이전 ──────────────────────────────────────────────────
-- 상품마다 기존 시작 시간으로 기본 회차 1개 (정원 30)
insert into public.product_slots (product_id, start_time, capacity, position)
select p.id, p.start_time, 30, 0
from public.products p
on conflict do nothing;
--> statement-breakpoint
update public.cart_items c
set slot_id = s.id
from public.product_slots s
where s.product_id = c.product_id and c.slot_id is null;
--> statement-breakpoint
alter table public.cart_items alter column slot_id set not null;
--> statement-breakpoint

-- 바우처 코드: 10자리 영숫자(16진수 대문자). 겹치면 다시 뽑는다 (unique 제약이 최종 방어)
create or replace function public.generate_voucher_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.order_items oi where oi.voucher_code = v_code);
  end loop;
  return v_code;
end;
$$;
--> statement-breakpoint

-- 지금까지의 주문은 모두 즉시 확정 상품이었다: 취소된 주문 → cancelled, 나머지 → confirmed
update public.order_items oi
set slot_id = s.id,
    start_time = s.start_time,
    partner_id = p.partner_id,
    commission_rate = pa.commission_rate,
    status = case when o.status::text = 'cancelled' then 'cancelled' else 'confirmed' end::public.order_item_status,
    cancelled_at = case when o.status::text = 'cancelled' then o.cancelled_at end,
    confirmed_at = o.paid_at
from public.orders o, public.products p, public.partners pa, public.product_slots s
where o.id = oi.order_id
  and p.id = oi.product_id
  and pa.id = p.partner_id
  and s.product_id = p.id;
--> statement-breakpoint
update public.order_items
set voucher_code = public.generate_voucher_code()
where status::text = 'confirmed' and voucher_code is null;
--> statement-breakpoint
alter table public.order_items alter column slot_id set not null;
--> statement-breakpoint
alter table public.order_items alter column partner_id set not null;
--> statement-breakpoint
alter table public.order_items alter column commission_rate set not null;
--> statement-breakpoint
-- 예약 인원 카운터를 지금 있는 항목으로 맞춘다 (불변식의 시작점)
insert into public.slot_inventory (slot_id, use_date, booked)
select oi.slot_id, oi.use_date, sum(oi.adult_qty + oi.child_qty)
from public.order_items oi
where oi.status::text in ('pending', 'confirmed', 'used')
group by oi.slot_id, oi.use_date
on conflict (slot_id, use_date) do update set booked = excluded.booked;
--> statement-breakpoint

-- ─── 2) 예약 규칙 · 금액 계산 · 장바구니 트리거 ──────────────────────────────
-- ⚠ 시그니처가 바뀌므로 지우고 다시 만든다 (회차·옵션 인자 추가)
drop function public.booking_error(uuid, date, integer, integer);
--> statement-breakpoint
-- 예약할 수 없으면 이유 코드, 가능하면 null. 장바구니 트리거와 place_order가 같은 함수를 쓴다.
-- 화면용 같은 규칙은 src/lib/booking.ts (달력 비활성·잔여석 표시용 — 최종 판단은 항상 이 함수).
-- 잔여석 확인은 잠그지 않는다: 장바구니는 자리를 잡아 두지 않고, 결제(place_order)에서 원자적으로 확보한다.
create function public.booking_error(
  p_product_id uuid,
  p_use_date date,
  p_slot_id uuid,
  p_adult integer,
  p_child integer,
  p_option_ids uuid[] default '{}'
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_product record;
  v_days integer := p_use_date - public.seoul_today();
  v_slot_capacity integer;
  v_capacity integer;
  v_closed boolean;
  v_booked integer;
  v_option_count integer := coalesce(cardinality(p_option_ids), 0);
begin
  select p.unavailable_reason, p.suspended_reason, p.published_at, p.child_price,
         p.operating_days, p.cutoff_days, p.max_qty
  into v_product
  from public.products p
  where p.id = p_product_id;

  if not found then
    return 'product_not_found';
  end if;
  -- 임시 저장(published_at 없음)·파트너 판매 중단·관리자 판매 중지 모두 "판매하지 않음"
  if v_product.published_at is null
     or v_product.unavailable_reason is not null
     or v_product.suspended_reason is not null then
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

  -- 회차: 이 상품의 판매 중인 회차여야 한다
  select s.capacity into v_slot_capacity
  from public.product_slots s
  where s.id = p_slot_id and s.product_id = p_product_id and s.active;
  if not found then
    return 'slot_not_found';
  end if;

  -- 옵션: 이 상품의 판매 중인 옵션이고, 같은 옵션을 두 번 고르지 않았어야 한다
  if v_option_count > 0 and (
       (select count(distinct x) from unnest(p_option_ids) as x) <> v_option_count
    or (select count(*) from public.product_options o
        where o.id = any(p_option_ids) and o.product_id = p_product_id and o.active) <> v_option_count
  ) then
    return 'option_invalid';
  end if;

  -- 날짜별 재고: 행이 없으면 회차 기본 정원, 예약 0명
  select i.capacity, i.closed, i.booked into v_capacity, v_closed, v_booked
  from public.slot_inventory i
  where i.slot_id = p_slot_id and i.use_date = p_use_date;
  if coalesce(v_closed, false) then
    return 'slot_closed';
  end if;
  if p_adult + p_child > coalesce(v_capacity, v_slot_capacity) - coalesce(v_booked, 0) then
    return 'sold_out';
  end if;
  return null;
end;
$$;
--> statement-breakpoint

-- 한 줄(상품·회차·날짜·인원·옵션)의 금액. 날짜·회차에 덮어쓴 가격이 있으면 그것, 없으면 상품 가격.
-- place_order와 장바구니 화면이 같은 공식을 쓴다 (화면 금액 = 결제 금액). TS 판: src/lib/booking.ts lineTotal
create function public.line_price(
  p_product_id uuid,
  p_slot_id uuid,
  p_use_date date,
  p_adult integer,
  p_child integer,
  p_option_ids uuid[] default '{}'
)
returns table (adult_price integer, child_price integer, options_amount integer, subtotal integer)
language sql
stable
set search_path = ''
as $$
  with base as (
    select coalesce(i.adult_price, p.adult_price) as adult_price,
           -- 성인 전용 상품(child_price null)은 덮어쓴 아동 가격이 있어도 아동 판매 안 함
           case when p.child_price is null then null else coalesce(i.child_price, p.child_price) end as child_price
    from public.products p
    left join public.slot_inventory i on i.slot_id = p_slot_id and i.use_date = p_use_date
    where p.id = p_product_id
  ), opts as (
    select coalesce(sum(
             case when o.unit::text = 'per_person' then o.price * (p_adult + p_child) else o.price end
           ), 0)::integer as amount
    from public.product_options o
    where o.id = any(coalesce(p_option_ids, '{}')) and o.product_id = p_product_id
  )
  select b.adult_price,
         b.child_price,
         opts.amount,
         (b.adult_price * p_adult + coalesce(b.child_price, 0) * p_child + opts.amount)::integer
  from base b
  cross join opts;
$$;
--> statement-breakpoint

create or replace function public.validate_cart_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_error text;
begin
  -- 회차를 보내지 않은 요청(회차 선택 전 화면)은 상품의 첫 회차로 채운다 — 배포 순서와 상관없이 담기가 동작하게
  if new.slot_id is null then
    select s.id into new.slot_id
    from public.product_slots s
    where s.product_id = new.product_id and s.active
    order by s.position, s.start_time nulls first
    limit 1;
  end if;
  new.option_ids := coalesce(new.option_ids, '{}');

  v_error := public.booking_error(
    new.product_id, new.use_date, new.slot_id, new.adult_qty, new.child_qty, new.option_ids
  );
  if v_error is not null then
    raise exception '%', v_error;
  end if;
  return new;
end;
$$;
--> statement-breakpoint
-- 회차·옵션이 바뀔 때도 검사하도록 트리거를 다시 만든다
drop trigger cart_items_validate on public.cart_items;
--> statement-breakpoint
create trigger cart_items_validate
  before insert or update of product_id, slot_id, use_date, adult_qty, child_qty, option_ids
  on public.cart_items
  for each row execute function public.validate_cart_item();
--> statement-breakpoint

-- 정원을 이미 예약된 인원보다 줄이지 못하게 한다 (파트너 재고 수정)
create or replace function public.guard_inventory_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.capacity is not null and new.capacity < new.booked then
    raise exception 'capacity_below_booked';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger slot_inventory_guard_capacity
  before insert or update of capacity on public.slot_inventory
  for each row execute function public.guard_inventory_capacity();
--> statement-breakpoint
-- 회차 기본 정원을 줄일 때: 날짜별로 덮어쓰지 않은(기본 정원을 쓰는) 앞으로의 날짜 중 예약이 더 많으면 거부
create or replace function public.guard_slot_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.capacity < old.capacity and exists (
    select 1 from public.slot_inventory i
    where i.slot_id = new.id
      and i.capacity is null
      and i.use_date >= public.seoul_today()
      and i.booked > new.capacity
  ) then
    raise exception 'capacity_below_booked';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger product_slots_guard_capacity
  before update of capacity on public.product_slots
  for each row execute function public.guard_slot_capacity();
--> statement-breakpoint

-- ─── 3) 주문 ──────────────────────────────────────────────────────────
-- 플래너 예약 항목의 시간은 상품이 아니라 주문 항목의 회차 시간으로 (0007 함수 수정)
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
  select oi.use_date, oi.product_title, oi.product_id, oi.start_time, o.order_no
  into v_item
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = p_order_item_id;

  -- 여행 기간 밖이면 넣지 않는다 (호출하는 쪽이 걸러 주지만 한 번 더 확인)
  if v_start is null or v_item.use_date is null or v_item.use_date not between v_start and v_end then
    return;
  end if;
  v_day := v_item.use_date - v_start;

  -- 자리: 그날 항목 중 시작 시간이 더 늦은 첫 항목 앞. 시간이 없거나 더 늦은 항목이 없으면 맨 끝.
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

-- 장바구니 항목으로 주문을 만든다 (모의 결제). 인자는 그대로 두고(앱 호환) 안을 바꾼다.
-- 클라이언트가 보내는 것은 장바구니 id·예약자·화면 총액·중복 방지 키뿐 — 금액·좌석은 모두 여기서 정한다.
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
  v_charged integer := 0;
  v_error text;
  v_line record;
  v_price record;
  v_product record;
  v_manual boolean;
  v_item_id uuid;
  v_trip record;
  v_created_trips uuid[] := '{}';
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;
  if p_idempotency_key is null then
    raise exception 'invalid';
  end if;

  -- ① 같은 결제 요청(두 번 클릭·재시도)이 이미 처리됐으면 그 주문번호를 그대로 돌려준다
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

  -- ② 본인 장바구니 행을 잠근다 (다른 탭의 같은 결제는 여기서 기다렸다가 cart_changed로 멈춘다)
  with locked as (
    select c.id
    from public.cart_items c
    where c.id = any(p_cart_item_ids) and c.user_id = v_user
    for update
  )
  select count(*) into v_locked from locked;

  if v_locked <> v_requested then
    select o.order_no into v_order_no
    from public.orders o
    where o.user_id = v_user and o.idempotency_key = p_idempotency_key;
    if found then
      return v_order_no;
    end if;
    raise exception 'cart_changed';
  end if;

  -- ③ 예약 조건 재검사 + 현재 가격으로 금액 계산 → 화면 금액과 다르면 결제하지 않는다
  for v_line in
    select c.product_id, c.slot_id, c.use_date, c.adult_qty, c.child_qty, c.option_ids
    from public.cart_items c
    where c.id = any(p_cart_item_ids)
  loop
    v_error := public.booking_error(
      v_line.product_id, v_line.use_date, v_line.slot_id, v_line.adult_qty, v_line.child_qty,
      v_line.option_ids
    );
    if v_error is not null then
      raise exception '%', v_error;
    end if;
    select lp.subtotal into v_price
    from public.line_price(v_line.product_id, v_line.slot_id, v_line.use_date,
                           v_line.adult_qty, v_line.child_qty, v_line.option_ids) lp;
    v_total := v_total + v_price.subtotal;
  end loop;

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

  -- ⑤ 좌석 확보 + 주문 항목. 회차·날짜 순서로 처리한다 → 두 결제가 같은 재고 행들을 늘 같은 순서로 잠가 교착이 없다.
  for v_line in
    select c.product_id, c.slot_id, c.use_date, c.adult_qty, c.child_qty, c.option_ids
    from public.cart_items c
    where c.id = any(p_cart_item_ids)
    order by c.slot_id, c.use_date
  loop
    -- 좌석 확보 (초과 판매 방지의 핵심):
    --   행을 먼저 보장한 뒤, "남은 자리가 충분할 때만" booked를 늘리는 UPDATE 한 문장으로 처리한다.
    --   같은 행을 동시에 바꾸려는 다른 결제는 행 잠금에서 기다렸다가, 바뀐 booked로 조건을 다시 평가한다.
    --   → 마지막 자리를 두 결제가 동시에 가져갈 수 없다. 0행이면 매진 → 주문 전체 롤백.
    insert into public.slot_inventory (slot_id, use_date)
    values (v_line.slot_id, v_line.use_date)
    on conflict do nothing;

    update public.slot_inventory i
    set booked = i.booked + v_line.adult_qty + v_line.child_qty
    from public.product_slots s
    where i.slot_id = v_line.slot_id
      and i.use_date = v_line.use_date
      and s.id = i.slot_id
      and not i.closed
      and i.booked + v_line.adult_qty + v_line.child_qty <= coalesce(i.capacity, s.capacity);
    if not found then
      raise exception 'sold_out';
    end if;

    select lp.adult_price, lp.child_price, lp.options_amount, lp.subtotal into v_price
    from public.line_price(v_line.product_id, v_line.slot_id, v_line.use_date,
                           v_line.adult_qty, v_line.child_qty, v_line.option_ids) lp;
    v_charged := v_charged + v_price.subtotal;

    select p.title, p.cancel_policy, p.confirmation_mode::text as mode, p.partner_id,
           pa.commission_rate, s.start_time
    into v_product
    from public.products p
    join public.partners pa on pa.id = p.partner_id
    join public.product_slots s on s.id = v_line.slot_id
    where p.id = v_line.product_id;

    -- 파트너 확정 상품: 확정 대기 + 처리 기한 = min(결제 + 48시간, 이용일 0시) (사용자 확정)
    v_manual := v_product.mode = 'manual';

    insert into public.order_items (
      order_id, product_id, product_title, use_date, adult_qty, child_qty,
      adult_price, child_price, subtotal, cancel_policy,
      status, slot_id, start_time, options_amount, partner_id, commission_rate,
      voucher_code, confirm_deadline, confirmed_at
    )
    values (
      v_order_id, v_line.product_id, v_product.title, v_line.use_date, v_line.adult_qty, v_line.child_qty,
      v_price.adult_price, v_price.child_price, v_price.subtotal, v_product.cancel_policy,
      (case when v_manual then 'pending' else 'confirmed' end)::public.order_item_status,
      v_line.slot_id, v_product.start_time, v_price.options_amount, v_product.partner_id,
      v_product.commission_rate,
      case when v_manual then null else public.generate_voucher_code() end,
      case when v_manual
        then least(now() + interval '48 hours', v_line.use_date::timestamp at time zone 'Asia/Seoul')
      end,
      case when v_manual then null else now() end
    )
    returning id into v_item_id;

    insert into public.order_item_options (order_item_id, option_id, name, unit, unit_price, qty, amount)
    select v_item_id, o.id, o.name, o.unit, o.price, q.qty, o.price * q.qty
    from public.product_options o
    cross join lateral (
      select case when o.unit::text = 'per_person' then v_line.adult_qty + v_line.child_qty else 1 end as qty
    ) q
    where o.id = any(v_line.option_ids) and o.product_id = v_line.product_id;
  end loop;

  -- ③과 ⑤ 사이에 가격이 바뀌었으면(파트너 수정) 결제하지 않는다
  if v_charged <> v_total then
    raise exception 'price_changed';
  end if;

  delete from public.cart_items c where c.id = any(p_cart_item_ids);

  -- ⑥ 플래너 연결 (확정 대기 항목도 넣는다 — 거절·만료되면 release_item이 지운다)
  for v_line in
    select oi.id, oi.use_date, ci.name as city_name
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
        update public.trips t
        set end_date = v_line.use_date,
            title = case when t.title = v_line.city_name || ' 여행' then t.title else '일본 여행' end
        where t.id = v_trip.id;
      else
        insert into public.trips (user_id, title, start_date, end_date, created_by_order_id)
        values (v_user, v_line.city_name || ' 여행', v_line.use_date, v_line.use_date, v_order_id)
        returning id, start_date into v_trip;
        v_created_trips := v_created_trips || v_trip.id;
      end if;
    end if;

    perform public.add_booking_to_trip(v_trip.id, v_line.id);
  end loop;

  return v_order_no;
end;
$$;
--> statement-breakpoint

-- ─── 4) 환불 · 해제 · 취소 ───────────────────────────────────────────────
-- ⚠ 반환 열(status)이 늘어 지우고 다시 만든다.
-- 취소할 수 있는 항목(확정 대기·확정)만, 확정 대기는 항상 100% (사용자 확정), 확정은 취소 규정 구간.
drop function public.refund_quote(uuid);
--> statement-breakpoint
create function public.refund_quote(p_order_id uuid)
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
        select t.refund_rate::integer
        from public.cancellation_policy_tiers t
        where t.policy_code = oi.cancel_policy
          and t.days_before <= oi.use_date - public.seoul_today()
        order by t.days_before desc
        limit 1
      ), 0)
    end as rate
  ) r
  where oi.order_id = p_order_id
    and oi.status::text in ('pending', 'confirmed')
  order by oi.use_date, oi.id;
$$;
--> statement-breakpoint

-- 항목 하나를 끝낸다 (취소·거절·만료 공통, 내부 전용 — 실행 권한 없음).
-- 좌석 반환 · 플래너 항목 삭제 · 주문 환불 합계/상태 갱신을 한곳에서 해서 카운터가 어긋나지 않게 한다.
-- 부르는 쪽이 주문 행과 항목 행을 잠그고 상태를 확인한 뒤 호출한다.
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
      reject_reason = case when p_status = 'rejected' then p_reason else oi.reject_reason end
  where oi.id = p_item_id;

  update public.slot_inventory i
  set booked = i.booked - v_item.qty
  where i.slot_id = v_item.slot_id and i.use_date = v_item.use_date;

  delete from public.trip_items ti where ti.order_item_id = p_item_id;
  -- 주문이 자동으로 만든 여행이 비었으면 함께 지운다 (0006과 같은 규칙)
  delete from public.trips t
  where t.created_by_order_id = v_item.order_id
    and not exists (select 1 from public.trip_items ti where ti.trip_id = t.id);

  -- 주문: 환불 합계 = 끝난 항목들의 환불액 합. 살아 있는 항목이 없으면 주문 전체가 취소 상태
  update public.orders o
  set refund_amount = (
        select coalesce(sum(oi.refund_amount), 0)
        from public.order_items oi
        where oi.order_id = o.id and oi.status::text in ('cancelled', 'rejected', 'expired')
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

-- 고객: 주문 항목 하나 취소. 돌려주는 값 = 환불액. 남의 항목은 not_found (존재 여부를 알 수 없게)
create or replace function public.cancel_order_item(p_item_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order_id uuid;
  v_item record;
  v_refund integer;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;

  -- 주문 행을 먼저 잠근다: 같은 주문의 항목 취소·거절이 동시에 와도 환불 합계·상태를 차례로 계산한다
  select o.id into v_order_id
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where oi.id = p_item_id and o.user_id = v_user
  for update of o;
  if not found then
    raise exception 'not_found';
  end if;

  select oi.status::text as status, oi.use_date, oi.subtotal into v_item
  from public.order_items oi
  where oi.id = p_item_id
  for update;

  if v_item.status in ('cancelled', 'rejected', 'expired') then
    raise exception 'already_cancelled';
  end if;
  if v_item.status = 'used' or v_item.use_date <= public.seoul_today() then
    raise exception 'not_cancellable';
  end if;

  select q.refund_amount into v_refund
  from public.refund_quote(v_order_id) q
  where q.order_item_id = p_item_id;

  perform public.release_item(p_item_id, 'cancelled', v_refund);
  return v_refund;
end;
$$;
--> statement-breakpoint

-- 고객: 주문 전체 취소 = 취소할 수 있는 항목(이용일 전의 확정 대기·확정)을 모두 취소. 돌려주는 값 = 환불 합계
create or replace function public.cancel_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
  v_refund integer := 0;
  v_count integer := 0;
  v_quote record;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;

  select o.status::text into v_status
  from public.orders o
  where o.id = p_order_id and o.user_id = v_user
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_status = 'cancelled' then
    raise exception 'already_cancelled';
  end if;

  for v_quote in
    select q.order_item_id, q.refund_amount
    from public.refund_quote(p_order_id) q
    where q.days_before > 0
  loop
    perform 1 from public.order_items oi where oi.id = v_quote.order_item_id for update;
    perform public.release_item(v_quote.order_item_id, 'cancelled', v_quote.refund_amount);
    v_refund := v_refund + v_quote.refund_amount;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'not_cancellable';
  end if;
  return v_refund;
end;
$$;
--> statement-breakpoint

-- 리뷰 자격: 이용 완료 처리됐거나, 확정된 예약의 이용일이 지났으면 (확정 대기·거절·취소·만료는 제외)
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
      and oi.product_id = p_product_id
      and (
        oi.status::text = 'used'
        or (oi.status::text = 'confirmed' and oi.use_date < public.seoul_today())
      )
  );
$$;
--> statement-breakpoint

-- 플래너에 붙일 예약: 살아 있는 항목(확정 대기·확정)만 (주문 상태 대신 항목 상태로)
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
      and oi.status::text in ('pending', 'confirmed')
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

-- ─── 5) 권한 ───────────────────────────────────────────────────────────
revoke all on public.product_slots, public.slot_inventory, public.product_options,
  public.order_item_options from anon, authenticated;
--> statement-breakpoint
-- 회차·재고(잔여석)·옵션은 공개 정보
grant select on public.product_slots, public.slot_inventory, public.product_options to anon, authenticated;
--> statement-breakpoint
-- 주문 옵션은 주문 항목을 볼 수 있는 사람만 (RLS)
grant select on public.order_item_options to authenticated;
--> statement-breakpoint
-- 파트너 쓰기 (어떤 상품인지는 RLS가 정한다). booked 컬럼과 재고 행 삭제는 주지 않는다 — 카운터 보호
grant insert (product_id, start_time, capacity, active, position) on public.product_slots to authenticated;
--> statement-breakpoint
grant update (start_time, capacity, active, position) on public.product_slots to authenticated;
--> statement-breakpoint
grant delete on public.product_slots to authenticated;
--> statement-breakpoint
grant insert (slot_id, use_date, capacity, closed, adult_price, child_price)
  on public.slot_inventory to authenticated;
--> statement-breakpoint
grant update (capacity, closed, adult_price, child_price) on public.slot_inventory to authenticated;
--> statement-breakpoint
grant insert (product_id, name, price, unit, active, position) on public.product_options to authenticated;
--> statement-breakpoint
grant update (name, price, unit, active, position) on public.product_options to authenticated;
--> statement-breakpoint
grant delete on public.product_options to authenticated;
--> statement-breakpoint
-- 장바구니: 회차·옵션도 고를 수 있다
grant insert (slot_id, option_ids) on public.cart_items to authenticated;
--> statement-breakpoint
grant update (slot_id, option_ids) on public.cart_items to authenticated;
--> statement-breakpoint

revoke execute on function public.generate_voucher_code() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.booking_error(uuid, date, uuid, integer, integer, uuid[]) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.line_price(uuid, uuid, date, integer, integer, uuid[]) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.refund_quote(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.release_item(uuid, text, integer, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.cancel_order_item(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.guard_inventory_capacity() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.guard_slot_capacity() from public, anon, authenticated;
--> statement-breakpoint
-- 장바구니 트리거가 사용자 권한으로 booking_error를 부른다. line_price는 장바구니 금액 표시용
grant execute on function public.booking_error(uuid, date, uuid, integer, integer, uuid[]) to authenticated;
--> statement-breakpoint
grant execute on function public.line_price(uuid, uuid, date, integer, integer, uuid[]) to authenticated;
--> statement-breakpoint
grant execute on function public.refund_quote(uuid) to authenticated;
--> statement-breakpoint
grant execute on function public.cancel_order_item(uuid) to authenticated;
