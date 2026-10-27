/**
 * RLS·권한·주문 함수 검증 스크립트 — `npm run db:verify-rls`
 *
 * 실제 DB에서 anon / 사용자 A / 사용자 B 역할로 쿼리를 실행해
 * "본인 데이터만 읽고 쓸 수 있는지", "주문 금액을 위조할 수 없는지"를 확인한다.
 * 전체를 하나의 트랜잭션에서 실행하고 마지막에 롤백하므로 DB에 아무것도 남지 않는다.
 *
 * 원리: Supabase API는 요청마다 `role`(anon/authenticated)과 JWT claims를 설정한 뒤 쿼리를 실행한다.
 * 여기서는 같은 설정을 SQL로 직접 해서 API를 거친 것과 같은 조건을 만든다.
 */
import { randomUUID } from "node:crypto";

import postgres from "postgres";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경 변수가 이미 주입된 경우
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL이 없습니다.");

const sql = postgres(databaseUrl, { prepare: false, max: 1 });

type Tx = postgres.TransactionSql;
type Role = { name: "anon" } | { name: "authenticated"; userId: string };

const results: { name: string; ok: boolean; detail: string }[] = [];

/** 지정한 역할로 fn을 실행한다. 세이브포인트 안에서 돌리므로 에러가 나도 바깥 트랜잭션은 계속된다 */
async function as<T>(tx: Tx, role: Role, fn: (sp: Tx) => Promise<T>): Promise<T> {
  // savepoint()의 반환 타입이 결과를 다시 감싸므로, 값은 바깥 변수로 꺼낸다
  let value: T | undefined;
  await tx.savepoint(async (sp) => {
    const claims =
      role.name === "anon" ? { role: "anon" } : { role: "authenticated", sub: role.userId };
    await sp`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
    await sp.unsafe(`set local role ${role.name}`);
    value = await fn(sp);
    await sp.unsafe("reset role");
  });
  return value as T;
}

/** 성공해야 하는 동작 */
async function expectOk(tx: Tx, name: string, role: Role, fn: (sp: Tx) => Promise<string>) {
  try {
    const detail = await as(tx, role, fn);
    results.push({ name, ok: true, detail });
  } catch (error) {
    results.push({ name, ok: false, detail: `예상치 못한 에러: ${(error as Error).message}` });
  }
}

/** 막혀야 하는 동작: 에러가 나거나 영향받은 행이 0이어야 통과 */
async function expectBlocked(tx: Tx, name: string, role: Role, fn: (sp: Tx) => Promise<number>) {
  try {
    const affected = await as(tx, role, fn);
    results.push({
      name,
      ok: affected === 0,
      detail: affected === 0 ? "0행 (RLS로 걸러짐)" : `✗ ${affected}행이 영향받음`,
    });
  } catch (error) {
    results.push({ name, ok: true, detail: `거부됨: ${(error as Error).message}` });
  }
}

/** 특정 오류 코드로 거부돼야 하는 동작 (DB 함수가 raise하는 코드까지 확인) */
async function expectError(
  tx: Tx,
  name: string,
  role: Role,
  code: string,
  fn: (sp: Tx) => Promise<unknown>,
) {
  try {
    await as(tx, role, fn);
    results.push({ name, ok: false, detail: `✗ 성공해 버림 (기대: ${code})` });
  } catch (error) {
    const message = (error as Error).message;
    results.push({ name, ok: message.includes(code), detail: `거부됨: ${message}` });
  }
}

function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
}

async function main() {
  await sql
    .begin(async (tx) => {
      // 테스트 사용자 2명 (auth.users에 넣으면 트리거가 profiles를 만든다)
      const userA = randomUUID();
      const userB = randomUUID();
      for (const [id, name] of [
        [userA, "검증A"],
        [userB, "검증B"],
      ] as const) {
        await tx`insert into auth.users (id, email, raw_user_meta_data, aud, role)
                 values (${id}, ${`${id}@rls.test`}, ${sql.json({ name })}, 'authenticated', 'authenticated')`;
      }
      const A: Role = { name: "authenticated", userId: userA };
      const B: Role = { name: "authenticated", userId: userB };
      const anon: Role = { name: "anon" };

      // 시드 상품: 매일 운영·마감 2일·일반 취소 규정(후지산), 수요일 휴무(다도), 성인 전용(야타이), 판매 중지(니세코)
      const products = await tx<
        { slug: string; id: string; adult_price: number; child_price: number | null }[]
      >`select slug, id, adult_price, child_price from public.products
        where slug in ('tokyo-fuji-kawaguchiko-bus', 'kyoto-machiya-tea-ceremony',
                       'fukuoka-nakasu-yatai', 'sapporo-niseko-lift-1day')`;
      const bySlug = new Map(products.map((p) => [p.slug, p]));
      const fuji = bySlug.get("tokyo-fuji-kawaguchiko-bus");
      const tea = bySlug.get("kyoto-machiya-tea-ceremony");
      const yatai = bySlug.get("fukuoka-nakasu-yatai");
      const niseko = bySlug.get("sapporo-niseko-lift-1day");
      if (!fuji || !tea || !yatai || !niseko || fuji.child_price === null) {
        throw new Error("시드 상품이 없습니다. 먼저 npm run db:seed를 실행하세요.");
      }

      // 날짜는 DB의 seoul_today() 기준으로 계산한다 (스크립트를 실행한 PC 시간대와 무관)
      const [dates] = await tx<
        { today: string; d1: string; d10: string; wed: string; past: string }[]
      >`select public.seoul_today()::text as today,
               (public.seoul_today() + 1)::text as d1,
               (public.seoul_today() + 10)::text as d10,
               (select d::date::text from generate_series(public.seoul_today() + 5, public.seoul_today() + 11, interval '1 day') d
                 where extract(isodow from d) = 3 limit 1) as wed,
               (public.seoul_today() - 5)::text as past`;
      if (!dates) throw new Error("날짜 계산 실패");

      /** 관리자 권한으로 주문 항목을 직접 넣는다 (지난 날짜 등 place_order가 거부하는 상황 준비용).
       *  회차(시간 포함)는 상품의 첫 판매 회차, 파트너·수수료는 상품에서 복사한다. booked 카운터는 바꾸지 않는다 */
      const insertItem = (
        orderId: string,
        productId: string,
        title: string,
        useDate: string,
        price: number,
        status = "confirmed",
      ) => tx`
        insert into public.order_items (order_id, product_id, product_title, use_date, adult_qty, child_qty,
          adult_price, subtotal, cancel_policy, slot_id, start_time, partner_id, commission_rate, status)
        select ${orderId}, p.id, ${title}, ${useDate}::date, 1, 0, ${price}, ${price}, 'standard',
          s.id, s.start_time, p.partner_id, 15, ${status}::public.order_item_status
        from public.products p
        cross join lateral (
          select s.id, s.start_time from public.product_slots s
          where s.product_id = p.id and s.active order by s.position limit 1
        ) s
        where p.id = ${productId}`;
      const dayPlus = async (n: number) => {
        const [row] = await tx<
          { d: string }[]
        >`select (public.seoul_today() + ${n}::int)::text as d`;
        if (!row) throw new Error("날짜 계산 실패");
        return row.d;
      };

      // ── 회원가입 트리거
      const [profile] = await tx<
        { display_name: string }[]
      >`select display_name from public.profiles where id = ${userA}`;
      check(
        "가입 트리거가 profiles 생성",
        profile?.display_name === "검증A",
        profile?.display_name ?? "없음",
      );

      // ── 공개 데이터
      await expectOk(tx, "anon: 상품 읽기", anon, async (sp) => {
        const rows = await sp`select id from public.products`;
        return `${rows.length}행`;
      });
      await expectBlocked(tx, "anon: 상품 추가", anon, async (sp) => {
        const r = await sp`insert into public.products (slug) values ('x')`;
        return r.count;
      });
      await expectBlocked(tx, "사용자: 상품 가격 수정", A, async (sp) => {
        const r = await sp`update public.products set adult_price = 1 where id = ${fuji.id}`;
        return r.count;
      });

      // ── 여행·일정
      const [tripA] = await as(
        tx,
        A,
        (sp) => sp<{ id: string }[]>`
        insert into public.trips (title, start_date, end_date) values ('A의 여행', '2030-11-02', '2030-11-04') returning id`,
      );
      if (!tripA) throw new Error("A의 여행 생성 실패");
      check("A: 여행 생성 (user_id 자동 = 본인)", true, tripA.id);

      await expectBlocked(
        tx,
        "anon: 여행 읽기",
        anon,
        async (sp) => (await sp`select 1 from public.trips`).length,
      );
      await expectBlocked(
        tx,
        "B: A의 여행 읽기",
        B,
        async (sp) => (await sp`select 1 from public.trips where id = ${tripA.id}`).length,
      );
      await expectBlocked(
        tx,
        "B: A의 여행 수정",
        B,
        async (sp) =>
          (await sp`update public.trips set title = '탈취' where id = ${tripA.id}`).count,
      );
      await expectBlocked(
        tx,
        "B: A의 여행 삭제",
        B,
        async (sp) => (await sp`delete from public.trips where id = ${tripA.id}`).count,
      );
      await expectBlocked(
        tx,
        "B: A의 여행에 일정 항목 추가",
        B,
        async (sp) =>
          (
            await sp`insert into public.trip_items (trip_id, day_index, position, title) values (${tripA.id}, 0, 0, '침입')`
          ).count,
      );
      await expectOk(tx, "A: 본인 여행에 일정 항목 추가 (상품 연결)", A, async (sp) => {
        const r =
          await sp`insert into public.trip_items (trip_id, day_index, position, title, product_id) values (${tripA.id}, 0, 0, '후지산 투어', ${fuji.id})`;
        return `${r.count}행`;
      });

      // 순서 변경 함수(reorder_trip_items): security invoker라 RLS가 적용돼야 한다
      const [second] = await as(
        tx,
        A,
        (sp) => sp<{ id: string }[]>`
        insert into public.trip_items (trip_id, day_index, position, title) values (${tripA.id}, 0, 1, '저녁 식사') returning id`,
      );
      const order = async () =>
        (
          await tx<{ title: string }[]>`
          select title from public.trip_items where trip_id = ${tripA.id} and day_index = 0 order by position`
        )
          .map((r) => r.title)
          .join(" → ");
      const allIds = (
        await tx<{ id: string }[]>`
        select id from public.trip_items where trip_id = ${tripA.id} and day_index = 0 order by position`
      ).map((r) => r.id);
      const reversed = [...allIds].reverse();

      const beforeOrder = await order();
      await as(
        tx,
        B,
        (sp) => sp`select public.reorder_trip_items(${tripA.id}, 0::smallint, ${reversed}::uuid[])`,
      );
      const afterB = await order();
      check(
        "B: A의 일정 순서 바꾸기 (RPC)",
        afterB === beforeOrder,
        afterB === beforeOrder ? `변화 없음 (${afterB})` : `✗ 바뀜: ${afterB}`,
      );
      await as(
        tx,
        A,
        (sp) => sp`select public.reorder_trip_items(${tripA.id}, 0::smallint, ${reversed}::uuid[])`,
      );
      const afterA = await order();
      check(
        "A: 본인 일정 순서 바꾸기 (RPC)",
        Boolean(second) && afterA !== beforeOrder,
        `${beforeOrder} ⇒ ${afterA}`,
      );
      await expectBlocked(
        tx,
        "anon: 순서 변경 함수 실행",
        anon,
        async (sp) =>
          (
            await sp`select public.reorder_trip_items(${tripA.id}, 0::smallint, ${reversed}::uuid[])`
          ).count,
      );
      await expectBlocked(
        tx,
        "A: user_id를 B로 지정해 여행 생성",
        A,
        async (sp) =>
          (
            await sp`insert into public.trips (user_id, title, start_date, end_date) values (${userB}, 'x', '2026-01-01', '2026-01-01')`
          ).count,
      );
      await expectBlocked(
        tx,
        "A: 여행의 created_by_order_id 직접 지정 (컬럼 권한)",
        A,
        async (sp) =>
          (
            await sp`update public.trips set created_by_order_id = ${randomUUID()} where id = ${tripA.id}`
          ).count,
      );
      await expectBlocked(
        tx,
        "A: 직접 '예약' 유형 일정 항목 만들기",
        A,
        async (sp) =>
          (
            await sp`insert into public.trip_items (trip_id, day_index, position, title, type) values (${tripA.id}, 1, 0, '가짜 예약', 'booking')`
          ).count,
      );

      // ── 찜·폴더
      const [folderA] = await as(
        tx,
        A,
        (sp) => sp<{ id: string }[]>`
        insert into public.like_folders (name) values ('가을 후보') returning id`,
      );
      if (!folderA) throw new Error("A의 폴더 생성 실패");
      await expectBlocked(
        tx,
        "B: A의 폴더에 찜 넣기",
        B,
        async (sp) =>
          (
            await sp`insert into public.likes (product_id, folder_id) values (${fuji.id}, ${folderA.id})`
          ).count,
      );
      await expectOk(tx, "B: 폴더 없이 찜하기", B, async (sp) => {
        const r = await sp`insert into public.likes (product_id) values (${fuji.id})`;
        return `${r.count}행`;
      });
      await expectBlocked(
        tx,
        "A: B의 찜 읽기",
        A,
        async (sp) => (await sp`select 1 from public.likes where user_id = ${userB}`).length,
      );
      await expectBlocked(
        tx,
        "B: 내 찜을 A의 폴더로 이동",
        B,
        async (sp) =>
          (
            await sp`update public.likes set folder_id = ${folderA.id} where product_id = ${fuji.id}`
          ).count,
      );

      // ── Storage (리뷰 사진): 경로 첫 폴더가 본인 id여야 업로드 가능
      await expectOk(tx, "A: 내 폴더에 리뷰 사진 업로드", A, async (sp) => {
        const r =
          await sp`insert into storage.objects (bucket_id, name) values ('review-photos', ${`${userA}/rls-test.jpg`})`;
        return `${r.count}행`;
      });
      await expectBlocked(
        tx,
        "A: B의 폴더에 리뷰 사진 업로드",
        A,
        async (sp) =>
          (
            await sp`insert into storage.objects (bucket_id, name) values ('review-photos', ${`${userB}/rls-test.jpg`})`
          ).count,
      );
      await expectBlocked(
        tx,
        "anon: 리뷰 사진 업로드",
        anon,
        async (sp) =>
          (
            await sp`insert into storage.objects (bucket_id, name) values ('review-photos', ${`${userA}/anon.jpg`})`
          ).count,
      );
      await expectBlocked(
        tx,
        "B: A의 사진 덮어쓰기",
        B,
        async (sp) =>
          (
            await sp`update storage.objects set metadata = '{}'::jsonb where bucket_id = 'review-photos' and name = ${`${userA}/rls-test.jpg`}`
          ).count,
      );

      // ── 장바구니: 예약 규칙은 트리거(booking_error)가 강제한다
      await expectBlocked(
        tx,
        "anon: 장바구니 읽기",
        anon,
        async (sp) => (await sp`select 1 from public.cart_items`).length,
      );
      const [cartA] = await as(
        tx,
        A,
        (sp) => sp<{ id: string }[]>`
        insert into public.cart_items (product_id, use_date, adult_qty, child_qty)
        values (${fuji.id}, ${dates.d10}, 2, 1) returning id`,
      );
      if (!cartA) throw new Error("A의 장바구니 담기 실패");
      check("A: 장바구니 담기 (10일 뒤, 성인 2 · 아동 1)", true, cartA.id);

      await expectError(
        tx,
        "A: 마감 지난 날짜 담기 (2일 전 마감 상품을 내일로)",
        A,
        "cutoff",
        (sp) =>
          sp`insert into public.cart_items (product_id, use_date) values (${fuji.id}, ${dates.d1})`,
      );
      await expectError(
        tx,
        "A: 운영하지 않는 요일 담기 (수요일 휴무)",
        A,
        "closed_day",
        (sp) =>
          sp`insert into public.cart_items (product_id, use_date) values (${tea.id}, ${dates.wed})`,
      );
      await expectError(
        tx,
        "A: 최대 인원 초과 (11명)",
        A,
        "qty",
        (sp) =>
          sp`insert into public.cart_items (product_id, use_date, adult_qty) values (${fuji.id}, ${dates.d10}::date + 1, 11)`,
      );
      await expectError(
        tx,
        "A: 성인 전용 상품에 아동 담기",
        A,
        "child_unavailable",
        (sp) =>
          sp`insert into public.cart_items (product_id, use_date, adult_qty, child_qty) values (${yatai.id}, ${dates.d10}, 1, 1)`,
      );
      await expectError(
        tx,
        "A: 판매 중지 상품 담기",
        A,
        "unavailable",
        (sp) =>
          sp`insert into public.cart_items (product_id, use_date) values (${niseko.id}, ${dates.d10})`,
      );
      await expectBlocked(
        tx,
        "A: user_id를 B로 지정해 장바구니 담기",
        A,
        async (sp) =>
          (
            await sp`insert into public.cart_items (user_id, product_id, use_date) values (${userB}, ${fuji.id}, ${dates.d10})`
          ).count,
      );
      await expectBlocked(
        tx,
        "A: 내 장바구니 항목을 B 것으로 바꾸기",
        A,
        async (sp) =>
          (await sp`update public.cart_items set user_id = ${userB} where id = ${cartA.id}`).count,
      );
      await expectBlocked(
        tx,
        "B: A의 장바구니 읽기",
        B,
        async (sp) => (await sp`select 1 from public.cart_items where id = ${cartA.id}`).length,
      );
      await expectBlocked(
        tx,
        "B: A의 장바구니 수량 바꾸기",
        B,
        async (sp) =>
          (await sp`update public.cart_items set adult_qty = 5 where id = ${cartA.id}`).count,
      );

      // ── 주문: 직접 쓰기는 막히고, place_order 함수만 주문을 만든다
      const realTotal = fuji.adult_price * 2 + fuji.child_price;
      await expectBlocked(
        tx,
        "A: 주문 직접 만들기 (금액 임의 지정)",
        A,
        async (sp) =>
          (
            await sp`insert into public.orders (order_no, user_id, booker_name, booker_email, booker_phone, total_amount, idempotency_key, policy_agreed_at)
                     values ('HACK', ${userA}, 'A', 'a@rls.test', '010-1234-5678', 1, ${randomUUID()}, now())`
          ).count,
      );
      await expectBlocked(
        tx,
        "anon: 주문 함수 실행",
        anon,
        async (sp) =>
          (
            await sp`select public.place_order(${[cartA.id]}::uuid[], 'x', 'x@x.x', '010-1234-5678', true, ${realTotal}, ${randomUUID()})`
          ).count,
      );
      const placeOrder = (sp: Tx, cartIds: string[], total: number, key: string) =>
        sp<{ order_no: string }[]>`
        select public.place_order(${cartIds}::uuid[], '검증A', 'a@rls.test', '010-1234-5678', true, ${total}, ${key}::uuid) as order_no`;

      await expectError(tx, "B: A의 장바구니 항목으로 주문", B, "cart_changed", (sp) =>
        placeOrder(sp, [cartA.id], realTotal, randomUUID()),
      );
      await expectError(tx, "A: 화면 금액 위조(1,000원)로 결제", A, "price_changed", (sp) =>
        placeOrder(sp, [cartA.id], 1000, randomUUID()),
      );
      await expectError(
        tx,
        "A: 취소 규정 동의 없이 결제",
        A,
        "policy_not_agreed",
        (sp) =>
          sp`select public.place_order(${[cartA.id]}::uuid[], '검증A', 'a@rls.test', '010-1234-5678', false, ${realTotal}, ${randomUUID()}::uuid)`,
      );

      const key = randomUUID();
      const [placed] = await as(tx, A, (sp) => placeOrder(sp, [cartA.id], realTotal, key));
      if (!placed) throw new Error("A의 주문 실패");
      const [orderRow] = await tx<{ id: string; total_amount: number }[]>`
        select id, total_amount from public.orders where order_no = ${placed.order_no}`;
      if (!orderRow) throw new Error("주문 행이 없습니다");
      check(
        "A: 주문 성공 · 금액은 DB 가격으로 계산",
        orderRow.total_amount === realTotal,
        `${placed.order_no} · ${orderRow.total_amount.toLocaleString()}원`,
      );

      const [again] = await as(tx, A, (sp) => placeOrder(sp, [cartA.id], realTotal, key));
      const [{ n: orderCount } = { n: 0 }] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.orders where user_id = ${userA}`;
      check(
        "A: 같은 결제 요청 재시도 → 같은 주문 (중복 생성 없음)",
        again?.order_no === placed.order_no && orderCount === 1,
        `${again?.order_no} · 주문 ${orderCount}건`,
      );
      const [{ n: cartLeft } = { n: -1 }] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.cart_items where id = ${cartA.id}`;
      check("주문한 장바구니 항목 삭제", cartLeft === 0, `남은 행 ${cartLeft}`);

      // 플래너 자동 연결: 이용일을 포함하는 여행이 없으므로 "도쿄 여행"이 새로 생긴다
      const [booking] = await tx<
        { id: string; trip_id: string; title: string; trip_title: string }[]
      >`
        select ti.id, ti.trip_id, ti.title, t.title as trip_title
        from public.trip_items ti
        join public.trips t on t.id = ti.trip_id
        join public.order_items oi on oi.id = ti.order_item_id
        where oi.order_id = ${orderRow.id}`;
      check(
        "주문 → 플래너에 예약 항목 자동 추가",
        booking?.trip_title === "도쿄 여행",
        booking ? `${booking.trip_title} · ${booking.title}` : "없음",
      );
      if (!booking) throw new Error("예약 항목이 없습니다");

      await expectError(
        tx,
        "A: 예약 항목을 다른 날로 옮기기",
        A,
        "booking_locked",
        (sp) => sp`update public.trip_items set day_index = 1 where id = ${booking.id}`,
      );
      await expectBlocked(
        tx,
        "A: 예약 항목을 일정에서 직접 삭제",
        A,
        async (sp) => (await sp`delete from public.trip_items where id = ${booking.id}`).count,
      );
      await expectError(
        tx,
        "A: 예약일이 빠지도록 여행 날짜 변경",
        A,
        "booking_out_of_range",
        (sp) =>
          sp`update public.trips set start_date = ${dates.d10}::date + 1, end_date = ${dates.d10}::date + 2 where id = ${booking.trip_id}`,
      );
      await expectOk(tx, "A: 예약 항목 메모 수정 (허용)", A, async (sp) => {
        const r =
          await sp`update public.trip_items set note = '집합 10분 전 도착' where id = ${booking.id}`;
        return `${r.count}행`;
      });

      await expectBlocked(
        tx,
        "B: A의 주문 읽기",
        B,
        async (sp) => (await sp`select 1 from public.orders where id = ${orderRow.id}`).length,
      );
      await expectBlocked(
        tx,
        "B: A의 주문 항목 읽기",
        B,
        async (sp) =>
          (await sp`select 1 from public.order_items where order_id = ${orderRow.id}`).length,
      );
      await expectBlocked(
        tx,
        "A: 주문 상태 직접 바꾸기",
        A,
        async (sp) =>
          (await sp`update public.orders set status = 'cancelled' where id = ${orderRow.id}`).count,
      );

      // ── 취소·환불
      const [quote] = await as(
        tx,
        A,
        (sp) => sp<{ refund_rate: number; refund_amount: number }[]>`
        select refund_rate, refund_amount from public.refund_quote(${orderRow.id})`,
      );
      check(
        "A: 환불 미리보기 (10일 전 · 일반 규정 100%)",
        quote?.refund_rate === 100 && quote.refund_amount === realTotal,
        `${quote?.refund_rate}% · ${quote?.refund_amount.toLocaleString()}원`,
      );
      await expectError(
        tx,
        "B: A의 주문 취소",
        B,
        "not_found",
        (sp) => sp`select public.cancel_order(${orderRow.id})`,
      );
      await expectOk(tx, "A: 주문 취소", A, async (sp) => {
        const [r] = await sp<
          { refund: number }[]
        >`select public.cancel_order(${orderRow.id}) as refund`;
        return `환불 ${r?.refund.toLocaleString()}원`;
      });
      const [{ n: bookingLeft } = { n: -1 }] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.trip_items where id = ${booking.id}`;
      check("취소 → 플래너 예약 항목도 삭제", bookingLeft === 0, `남은 행 ${bookingLeft}`);
      // 주문이 자동으로 만든 "도쿄 여행"은 비었으므로 함께 지워져야 한다 (사용자 피드백)
      const [{ n: autoTripLeft } = { n: -1 }] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.trips where id = ${booking.trip_id}`;
      check(
        "취소 → 비어 버린 자동 생성 여행도 삭제",
        autoTripLeft === 0,
        `남은 여행 ${autoTripLeft}`,
      );
      // 사용자가 직접 만든 여행(A의 여행)은 그대로
      const [{ n: ownTripLeft } = { n: -1 }] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.trips where id = ${tripA.id}`;
      check("취소해도 직접 만든 여행은 유지", ownTripLeft === 1, `남은 여행 ${ownTripLeft}`);
      await expectError(
        tx,
        "A: 같은 주문 두 번 취소",
        A,
        "already_cancelled",
        (sp) => sp`select public.cancel_order(${orderRow.id})`,
      );

      // 환불 구간 경계: 일반 규정 = 7일 전 100% · 3일 전 50% · 1일 전 20%
      // 남은 일수별 주문을 관리자 권한으로 만든 뒤, A 권한으로 미리보기 금액을 확인한다
      const boundaries: [days: number, rate: number][] = [
        [7, 100],
        [6, 50],
        [3, 50],
        [2, 20],
        [1, 20],
      ];
      const observed: string[] = [];
      let boundaryOk = true;
      for (const [days, rate] of boundaries) {
        const [o] = await tx<{ id: string }[]>`
          insert into public.orders (order_no, user_id, booker_name, booker_email, booker_phone, total_amount, idempotency_key, policy_agreed_at)
          values (${`TEST-${randomUUID()}`}, ${userA}, '검증A', 'a@rls.test', '010-1234-5678', 10000, ${randomUUID()}, now())
          returning id`;
        if (!o) throw new Error("경계 테스트 주문 생성 실패");
        await insertItem(o.id, fuji.id, "경계 테스트", await dayPlus(days), 10000);
        const [q] = await as(
          tx,
          A,
          (sp) =>
            sp<{ refund_rate: number }[]>`select refund_rate from public.refund_quote(${o.id})`,
        );
        observed.push(`${days}일 전 ${q?.refund_rate}%`);
        if (q?.refund_rate !== rate) boundaryOk = false;
      }
      check("환불 구간 경계 (7·6·3·2·1일 전)", boundaryOk, observed.join(" · "));

      // ── 새 여행을 만들면 그 기간의 예약이 붙는다 + 시작 시간 순 자리 (사용자 피드백)
      // 위에서 만든 "7일 뒤" 주문(후지산 투어, 08:00 시작)은 아직 플래너에 없다
      const [newTrip] = await as(
        tx,
        A,
        (sp) => sp<{ id: string }[]>`
        insert into public.trips (title, start_date, end_date)
        values ('다시 만든 여행', public.seoul_today() + 7, public.seoul_today() + 8) returning id`,
      );
      if (!newTrip) throw new Error("새 여행 생성 실패");
      // Day 1(= 7일 뒤)에 07:00 · 12:00 일정을 먼저 넣어 둔다
      await as(
        tx,
        A,
        (sp) => sp`insert into public.trip_items (trip_id, day_index, position, title, time)
                   values (${newTrip.id}, 0, 0, '아침 식사', '07:00'), (${newTrip.id}, 0, 1, '점심', '12:00')`,
      );
      await expectError(
        tx,
        "B: A의 여행에 예약 붙이기",
        B,
        "not_found",
        (sp) => sp`select public.attach_bookings(${newTrip.id})`,
      );
      const [attached] = await as(
        tx,
        A,
        (sp) => sp<{ n: number }[]>`select public.attach_bookings(${newTrip.id}) as n`,
      );
      const day2 = (
        await tx<{ title: string; type: string }[]>`
          select title, type::text from public.trip_items
          where trip_id = ${newTrip.id} and day_index = 0 order by position`
      )
        .map((r) => (r.type === "booking" ? `[예약]${r.title.slice(0, 6)}` : r.title))
        .join(" → ");
      check(
        "새 여행에 기존 예약 붙이기 (시작 시간 순 자리)",
        attached?.n === 1 && day2.startsWith("아침 식사 → [예약]") && day2.endsWith("→ 점심"),
        `${attached?.n}개 · ${day2}`,
      );
      const [again2] = await as(
        tx,
        A,
        (sp) => sp<{ n: number }[]>`select public.attach_bookings(${newTrip.id}) as n`,
      );
      check("다시 불러도 중복으로 붙지 않음", again2?.n === 0, `${again2?.n}개`);
      await expectBlocked(
        tx,
        "anon: 예약 붙이기 함수 실행",
        anon,
        async (sp) => (await sp`select public.attach_bookings(${newTrip.id})`).count,
      );

      const [todayOrder] = await tx<{ id: string }[]>`
        insert into public.orders (order_no, user_id, booker_name, booker_email, booker_phone, total_amount, idempotency_key, policy_agreed_at)
        values (${`TEST-${randomUUID()}`}, ${userA}, '검증A', 'a@rls.test', '010-1234-5678', 10000, ${randomUUID()}, now())
        returning id`;
      if (!todayOrder) throw new Error("당일 주문 생성 실패");
      await insertItem(todayOrder.id, fuji.id, "당일", dates.today, 10000);
      await expectError(
        tx,
        "A: 이용일 당일 취소",
        A,
        "not_cancellable",
        (sp) => sp`select public.cancel_order(${todayOrder.id})`,
      );

      // ── 리뷰: 이용일이 지난 구매 내역이 있어야 쓸 수 있다
      await expectBlocked(
        tx,
        "A: 구매하지 않은 상품에 리뷰",
        A,
        async (sp) =>
          (
            await sp`insert into public.reviews (product_id, rating, content) values (${tea.id}, 5, '구매하지 않았지만 써 봅니다')`
          ).count,
      );
      // 이용일 전(오늘 주문)인 후지산 투어로는 리뷰를 쓸 수 없다 — 위 당일 주문은 아직 '이용 완료'가 아님
      await expectBlocked(
        tx,
        "A: 이용일 전 상품에 리뷰",
        A,
        async (sp) =>
          (
            await sp`insert into public.reviews (product_id, rating, content) values (${fuji.id}, 5, '아직 이용하지 않았어요')`
          ).count,
      );
      // 지난 날짜 주문을 관리자 권한으로 만들어 '이용 완료' 상태를 만든다 (시드와 같은 방식)
      const [pastOrder] = await tx<{ id: string }[]>`
        insert into public.orders (order_no, user_id, booker_name, booker_email, booker_phone, total_amount, idempotency_key, policy_agreed_at)
        values (${`TEST-${randomUUID()}`}, ${userA}, '검증A', 'a@rls.test', '010-1234-5678', 38000, ${randomUUID()}, now())
        returning id`;
      if (!pastOrder) throw new Error("지난 주문 생성 실패");
      await insertItem(pastOrder.id, tea.id, "다도", dates.past, 38000);

      const [reviewA] = await as(
        tx,
        A,
        (sp) => sp<{ id: string }[]>`
        insert into public.reviews (product_id, rating, content) values (${tea.id}, 5, '정말 좋았던 체험이에요!') returning id`,
      );
      if (!reviewA) throw new Error("A의 리뷰 생성 실패");
      check("A: 이용 완료 상품에 리뷰 (구매 인증)", true, reviewA.id);
      await expectOk(
        tx,
        "anon: 리뷰 읽기",
        anon,
        async (sp) =>
          `${(await sp`select 1 from public.reviews where id = ${reviewA.id}`).length}행`,
      );
      await expectBlocked(
        tx,
        "A: 같은 상품에 리뷰 2개",
        A,
        async (sp) =>
          (
            await sp`insert into public.reviews (product_id, rating, content) values (${tea.id}, 4, '두 번째 리뷰입니다요')`
          ).count,
      );
      await expectBlocked(
        tx,
        "B: A의 리뷰 수정",
        B,
        async (sp) =>
          (
            await sp`update public.reviews set content = '다른 사람이 고친 리뷰' where id = ${reviewA.id}`
          ).count,
      );
      await expectBlocked(
        tx,
        "B: A의 리뷰 삭제",
        B,
        async (sp) => (await sp`delete from public.reviews where id = ${reviewA.id}`).count,
      );
      await expectBlocked(
        tx,
        "A: 리뷰의 상품 바꾸기 (컬럼 권한)",
        A,
        async (sp) =>
          (await sp`update public.reviews set product_id = ${fuji.id} where id = ${reviewA.id}`)
            .count,
      );
      await expectBlocked(
        tx,
        "A: 별점 6점",
        A,
        async (sp) =>
          (await sp`update public.reviews set rating = 6 where id = ${reviewA.id}`).count,
      );

      const [cache] = await tx<{ review_count: number }[]>`
        select review_count from public.products where id = ${tea.id}`;
      check(
        "리뷰 트리거가 평점 캐시 갱신",
        (cache?.review_count ?? 0) >= 1,
        `review_count=${cache?.review_count}`,
      );

      // ── 프로필
      await expectBlocked(
        tx,
        "B: A의 프로필 수정",
        B,
        async (sp) =>
          (await sp`update public.profiles set display_name = '탈취' where id = ${userA}`).count,
      );

      // ── 역할 · 파트너 신청/승인 · 파트너 상품
      // 관리자 C는 시드처럼 postgres 권한으로 지정한다 (앱에는 관리자를 만드는 길이 없다)
      const userC = randomUUID();
      await tx`insert into auth.users (id, email, raw_user_meta_data, aud, role)
               values (${userC}, ${`${userC}@rls.test`}, ${sql.json({ name: "검증관리자" })}, 'authenticated', 'authenticated')`;
      await tx`update public.profiles set role = 'admin' where id = ${userC}`;
      const admin: Role = { name: "authenticated", userId: userC };

      await expectError(
        tx,
        "anon: 프로필 역할(role) 읽기",
        anon,
        "permission denied",
        (sp) => sp`select role from public.profiles limit 1`,
      );
      await expectOk(tx, "anon: 프로필 표시 정보 읽기", anon, async (sp) => {
        const rows = await sp`select display_name from public.profiles where id = ${userA}`;
        return `${rows.length}행`;
      });

      const application = {
        business_name: "검증 트래블",
        contact_name: "검증A",
        contact_phone: "02-123-4567",
        contact_email: "a@rls.test",
        intro: "검증용 파트너 신청서입니다.",
      };
      const [appA] = await as(
        tx,
        A,
        (sp) =>
          sp<
            { id: string }[]
          >`insert into public.partner_applications ${sp(application)} returning id`,
      );
      check("A: 파트너 신청", Boolean(appA), appA ? "1건" : "실패");
      if (!appA) throw new Error("파트너 신청 실패");
      await expectError(
        tx,
        "A: 검토 중에 다시 신청",
        A,
        "application_pending",
        (sp) => sp`insert into public.partner_applications ${sp(application)}`,
      );
      await expectBlocked(
        tx,
        "B: A의 신청서 읽기",
        B,
        async (sp) =>
          (await sp`select 1 from public.partner_applications where id = ${appA.id}`).length,
      );
      await expectBlocked(
        tx,
        "A: 본인 신청서를 승인 상태로 바꾸기 (컬럼 권한)",
        A,
        async (sp) =>
          (
            await sp`update public.partner_applications set status = 'approved' where id = ${appA.id}`
          ).count,
      );
      await expectError(
        tx,
        "A: 승인 함수 호출",
        A,
        "forbidden",
        (sp) => sp`select public.approve_partner_application(${appA.id})`,
      );
      await expectOk(tx, "관리자: 신청서 읽기", admin, async (sp) => {
        const rows = await sp`select 1 from public.partner_applications where id = ${appA.id}`;
        return `${rows.length}행`;
      });
      await expectOk(tx, "관리자: 신청 승인", admin, async (sp) => {
        await sp`select public.approve_partner_application(${appA.id})`;
        return "승인";
      });
      await expectError(
        tx,
        "관리자: 이미 승인한 신청 다시 승인",
        admin,
        "not_pending",
        (sp) => sp`select public.approve_partner_application(${appA.id})`,
      );
      const [meA] = await as(
        tx,
        A,
        (sp) =>
          sp<
            { role: string; partner_id: string | null }[]
          >`select role, partner_id from public.my_profile()`,
      );
      check(
        "승인 후 A = 파트너 (my_profile)",
        meA?.role === "partner" && meA.partner_id !== null,
        `role=${meA?.role}`,
      );
      const partnerA = meA?.partner_id;
      if (!partnerA) throw new Error("파트너 생성 실패");
      await expectError(
        tx,
        "A(파트너): 다시 신청",
        A,
        "already_partner",
        (sp) => sp`insert into public.partner_applications ${sp(application)}`,
      );
      await expectBlocked(
        tx,
        "A: 본인 역할을 관리자로 (컬럼 권한)",
        A,
        async (sp) =>
          (await sp`update public.profiles set role = 'admin' where id = ${userA}`).count,
      );

      // 파트너 상품: partner_id는 기본값(my_partner_id())으로 채워진다
      const [kyotoCity] = await tx<
        { id: string }[]
      >`select id from public.cities where slug = 'kyoto'`;
      if (!kyotoCity) throw new Error("도시가 없습니다");
      const draft = {
        slug: `rls-draft-${userA.slice(0, 8)}`,
        city_id: kyotoCity.id,
        category: "tour",
        theme: "culture",
        title: "검증용 임시 상품",
        summary: "검증용",
        description: "검증용 상품 설명",
        image_url: "https://images.unsplash.com/photo-1",
        image_alt: "검증",
        adult_price: 10000,
        operating_days: [1, 2, 3, 4, 5, 6, 7],
        duration_text: "약 1시간",
        meeting_point: "교토역",
        latitude: 35,
        longitude: 135,
        cancel_policy: "standard",
      };
      const [draftRow] = await as(
        tx,
        A,
        (sp) =>
          sp<
            { id: string; partner_id: string }[]
          >`insert into public.products ${sp(draft)} returning id, partner_id`,
      );
      check(
        "A(파트너): 임시 저장 상품 만들기 (partner_id 자동)",
        draftRow?.partner_id === partnerA,
        draftRow ? "본인 파트너로 저장" : "실패",
      );
      if (!draftRow) throw new Error("파트너 상품 생성 실패");
      await expectBlocked(
        tx,
        "anon: 임시 저장 상품 보기",
        anon,
        async (sp) => (await sp`select 1 from public.products where id = ${draftRow.id}`).length,
      );
      await expectBlocked(
        tx,
        "B: 임시 저장 상품 보기",
        B,
        async (sp) => (await sp`select 1 from public.products where id = ${draftRow.id}`).length,
      );
      await expectOk(tx, "관리자: 임시 저장 상품 보기", admin, async (sp) => {
        const rows = await sp`select 1 from public.products where id = ${draftRow.id}`;
        return rows.length === 1 ? "1행" : `✗ ${rows.length}행`;
      });
      await expectBlocked(
        tx,
        "B(고객): 상품 만들기",
        B,
        async (sp) =>
          (await sp`insert into public.products ${sp({ ...draft, slug: "rls-b" })}`).count,
      );
      await expectBlocked(
        tx,
        "A(파트너): 다른 파트너 상품 수정",
        A,
        async (sp) =>
          (await sp`update public.products set title = '탈취' where id = ${fuji.id}`).count,
      );
      await expectBlocked(
        tx,
        "A(파트너): 본인 상품의 파트너 바꾸기 (컬럼 권한)",
        A,
        async (sp) =>
          (await sp`update public.products set partner_id = ${partnerA} where id = ${draftRow.id}`)
            .count,
      );
      await expectBlocked(
        tx,
        "A(파트너): 관리자 판매 중지 해제 (컬럼 권한)",
        A,
        async (sp) =>
          (await sp`update public.products set suspended_reason = null where id = ${draftRow.id}`)
            .count,
      );
      await expectError(
        tx,
        "A(파트너): 확정 필요 상품을 당일 마감으로",
        A,
        "products_manual_cutoff",
        (sp) =>
          sp`update public.products set confirmation_mode = 'manual', cutoff_days = 0 where id = ${draftRow.id}`,
      );
      await expectOk(tx, "A(파트너): 본인 상품 판매 시작", A, async (sp) => {
        const r =
          await sp`update public.products set published_at = now() where id = ${draftRow.id}`;
        return `${r.count}행`;
      });

      // 이용 정지 → my_partner_id()가 null → 본인 상품도 고칠 수 없다
      await expectError(
        tx,
        "B: 파트너 정지 함수 호출",
        B,
        "forbidden",
        (sp) => sp`select public.admin_set_partner_status(${partnerA}, 'suspended', '약관 위반')`,
      );
      await expectError(
        tx,
        "관리자: 사유 없이 파트너 이용 정지",
        admin,
        "invalid_status_reason",
        (sp) => sp`select public.admin_set_partner_status(${partnerA}, 'suspended', ' ')`,
      );
      await expectOk(tx, "관리자: 파트너 이용 정지 → 상품 함께 중지", admin, async (sp) => {
        const [r] = await sp<{ n: number }[]>`
          select public.admin_set_partner_status(${partnerA}, 'suspended', '고객 민원 반복') as n`;
        return `상품 ${r?.n}개 중지`;
      });
      const [cascaded] = await tx<
        { suspended_kind: string | null; suspended_reason: string | null }[]
      >`
        select suspended_kind::text, suspended_reason from public.products where id = ${draftRow.id}`;
      check(
        "파트너 정지: 그 파트너 상품이 partner_suspended로 중지",
        cascaded?.suspended_kind === "partner_suspended" &&
          cascaded.suspended_reason === "파트너 이용 정지",
        `${cascaded?.suspended_kind} · ${cascaded?.suspended_reason}`,
      );
      const [partnerLog] = await tx<{ reason: string | null }[]>`
        select reason from public.audit_logs where entity_id = ${partnerA} and action = 'partner.suspended'`;
      check(
        "감사 로그: 파트너 정지 사유",
        partnerLog?.reason === "고객 민원 반복",
        partnerLog?.reason ?? "없음",
      );
      await expectBlocked(
        tx,
        "정지된 파트너 A: 본인 상품 수정",
        A,
        async (sp) =>
          (await sp`update public.products set title = '정지 중 수정' where id = ${draftRow.id}`)
            .count,
      );

      // 거절 → 다시 신청 가능
      const [appB] = await as(
        tx,
        B,
        (sp) =>
          sp<
            { id: string }[]
          >`insert into public.partner_applications ${sp({ ...application, contact_name: "검증B" })} returning id`,
      );
      if (!appB) throw new Error("B 신청 실패");
      await expectError(
        tx,
        "관리자: 사유 없이 거절",
        admin,
        "invalid_reason",
        (sp) => sp`select public.reject_partner_application(${appB.id}, '  ')`,
      );
      await expectOk(tx, "관리자: 신청 거절", admin, async (sp) => {
        await sp`select public.reject_partner_application(${appB.id}, '사업 정보 확인이 필요합니다')`;
        return "거절";
      });
      await expectOk(tx, "B: 거절 후 다시 신청", B, async (sp) => {
        const r = await sp`insert into public.partner_applications ${sp(application)}`;
        return `${r.count}건`;
      });

      // ── 회차 재고 · 옵션 · 항목 상태 (S2)
      // 후지산 투어(매일 운영·마감 2일, 08:00 회차 정원 40, 옵션: 호텔 픽업 1만/건·도시락 1.2만/인)
      // 스노클링(파트너 확정 필요, 09:00·13:00 회차)
      const [fujiSlot] = await tx<{ id: string }[]>`
        select id from public.product_slots where product_id = ${fuji.id} and active order by position limit 1`;
      const [teaSlot] = await tx<{ id: string }[]>`
        select id from public.product_slots where product_id = ${tea.id} and active order by position limit 1`;
      const [snorkel] = await tx<{ id: string; adult_price: number; partner_id: string }[]>`
        select id, adult_price, partner_id from public.products where slug = 'okinawa-blue-cave-snorkel'`;
      const fujiOptions = await tx<{ id: string; name: string; price: number }[]>`
        select id, name, price from public.product_options where product_id = ${fuji.id} and active order by position`;
      const [snorkelOption] = await tx<{ id: string }[]>`
        select o.id from public.product_options o where o.product_id = ${snorkel?.id ?? null} limit 1`;
      const [pickup, lunch] = fujiOptions;
      if (!fujiSlot || !teaSlot || !snorkel || !pickup || !lunch || !snorkelOption) {
        throw new Error("회차·옵션 시드가 없습니다. 먼저 npm run db:seed를 실행하세요.");
      }
      const capDate = await dayPlus(13);
      const closedDate = await dayPlus(14);
      const optionDate = await dayPlus(15);
      const priceDate = await dayPlus(16);
      const booker = (sp: Tx, ids: string[], total: number) =>
        sp<{ order_no: string }[]>`
        select public.place_order(${ids}::uuid[], '검증', 'v@rls.test', '010-1234-5678', true, ${total}, ${randomUUID()}::uuid) as order_no`;
      const addCart = (sp: Tx, values: Record<string, unknown>) =>
        sp<{ id: string }[]>`insert into public.cart_items ${sp(values)} returning id`;
      const bookedOf = async (slotId: string, useDate: string) => {
        const [row] = await tx<{ booked: number }[]>`
          select booked from public.slot_inventory where slot_id = ${slotId} and use_date = ${useDate}`;
        return row?.booked ?? 0;
      };

      // 회차를 보내지 않은 담기(회차 선택 전 화면)는 트리거가 첫 회차로 채운다
      const [autoSlot] = await as(
        tx,
        A,
        (sp) =>
          sp<
            { slot_id: string }[]
          >`insert into public.cart_items (product_id, use_date) values (${fuji.id}, ${capDate}) returning slot_id`,
      );
      check(
        "회차 없이 담기 → 첫 회차 자동 지정",
        autoSlot?.slot_id === fujiSlot.id,
        autoSlot?.slot_id ?? "없음",
      );
      await tx`delete from public.cart_items where user_id = ${userA}`;

      // 정원 3인 날짜: A 2명 → B 2명은 매진, B 1명은 성공
      await tx`insert into public.slot_inventory (slot_id, use_date, capacity) values (${fujiSlot.id}, ${capDate}, 3)`;
      const [capCartA] = await as(tx, A, (sp) =>
        addCart(sp, { product_id: fuji.id, slot_id: fujiSlot.id, use_date: capDate, adult_qty: 2 }),
      );
      if (!capCartA) throw new Error("정원 테스트 담기 실패");
      const [capOrderA] = await as(tx, A, (sp) => booker(sp, [capCartA.id], fuji.adult_price * 2));
      check(
        "정원 3 · A 2명 결제 → 예약 인원 2",
        (await bookedOf(fujiSlot.id, capDate)) === 2,
        `booked=${await bookedOf(fujiSlot.id, capDate)}`,
      );
      await expectError(tx, "B: 남은 1석에 2명 담기", B, "sold_out", (sp) =>
        addCart(sp, { product_id: fuji.id, slot_id: fujiSlot.id, use_date: capDate, adult_qty: 2 }),
      );
      const [capCartB] = await as(tx, B, (sp) =>
        addCart(sp, { product_id: fuji.id, slot_id: fujiSlot.id, use_date: capDate, adult_qty: 1 }),
      );
      if (!capCartB) throw new Error("B 1명 담기 실패");
      // 결제 직전에 다른 사람이 마지막 자리를 가져간 상황 (카운터를 직접 올려 재현)
      await tx`update public.slot_inventory set booked = 3 where slot_id = ${fujiSlot.id} and use_date = ${capDate}`;
      const ordersBefore = (
        await tx<
          { n: number }[]
        >`select count(*)::int as n from public.orders where user_id = ${userB}`
      )[0]?.n;
      await expectError(tx, "B: 결제 순간 매진 → 결제 거부", B, "sold_out", (sp) =>
        booker(sp, [capCartB.id], fuji.adult_price),
      );
      const ordersAfter = (
        await tx<
          { n: number }[]
        >`select count(*)::int as n from public.orders where user_id = ${userB}`
      )[0]?.n;
      check(
        "매진으로 실패한 결제는 주문을 남기지 않음",
        ordersBefore === ordersAfter,
        `${ordersBefore} → ${ordersAfter}`,
      );
      await tx`update public.slot_inventory set booked = 2 where slot_id = ${fujiSlot.id} and use_date = ${capDate}`;
      await expectOk(tx, "B: 남은 1석 결제", B, async (sp) => {
        const [r] = await booker(sp, [capCartB.id], fuji.adult_price);
        return r?.order_no ?? "";
      });
      check(
        "예약 인원 = 정원 3",
        (await bookedOf(fujiSlot.id, capDate)) === 3,
        `booked=${await bookedOf(fujiSlot.id, capDate)}`,
      );

      const [capItemA] = await tx<{ id: string; status: string; voucher_code: string | null }[]>`
        select oi.id, oi.status::text, oi.voucher_code from public.order_items oi
        join public.orders o on o.id = oi.order_id where o.order_no = ${capOrderA?.order_no ?? ""}`;
      if (!capItemA) throw new Error("A 정원 테스트 항목 없음");
      check(
        "즉시 확정 상품 → 확정 + 바우처 발급",
        capItemA.status === "confirmed" && Boolean(capItemA.voucher_code),
        `${capItemA.status} · ${capItemA.voucher_code}`,
      );
      await expectError(
        tx,
        "B: A의 주문 항목 취소",
        B,
        "not_found",
        (sp) => sp`select public.cancel_order_item(${capItemA.id})`,
      );
      await expectOk(tx, "A: 항목 취소 → 좌석 반환", A, async (sp) => {
        const [r] = await sp<
          { refund: number }[]
        >`select public.cancel_order_item(${capItemA.id}) as refund`;
        return `환불 ${r?.refund.toLocaleString()}원`;
      });
      check(
        "취소 후 예약 인원 3 → 1",
        (await bookedOf(fujiSlot.id, capDate)) === 1,
        `booked=${await bookedOf(fujiSlot.id, capDate)}`,
      );
      await expectError(
        tx,
        "A: 취소한 항목 다시 취소",
        A,
        "already_cancelled",
        (sp) => sp`select public.cancel_order_item(${capItemA.id})`,
      );
      const [{ n: activeQty } = { n: -1 }] = await tx<{ n: number }[]>`
        select coalesce(sum(adult_qty + child_qty), 0)::int as n from public.order_items
        where slot_id = ${fujiSlot.id} and use_date = ${capDate} and status::text in ('pending', 'confirmed', 'used')`;
      check(
        "불변식: 예약 인원 = 살아 있는 항목 인원 합",
        activeQty === (await bookedOf(fujiSlot.id, capDate)),
        `${activeQty}명`,
      );

      // 마감 회차 · 다른 상품 회차/옵션
      await tx`insert into public.slot_inventory (slot_id, use_date, closed) values (${fujiSlot.id}, ${closedDate}, true)`;
      await expectError(tx, "A: 마감한 날짜·회차 담기", A, "slot_closed", (sp) =>
        addCart(sp, { product_id: fuji.id, slot_id: fujiSlot.id, use_date: closedDate }),
      );
      await expectError(tx, "A: 다른 상품의 회차로 담기", A, "slot_not_found", (sp) =>
        addCart(sp, { product_id: fuji.id, slot_id: teaSlot.id, use_date: optionDate }),
      );
      await expectError(
        tx,
        "A: 다른 상품의 옵션 고르기",
        A,
        "option_invalid",
        (sp) =>
          sp`insert into public.cart_items (product_id, slot_id, use_date, option_ids)
           values (${fuji.id}, ${fujiSlot.id}, ${optionDate}, ${[snorkelOption.id]}::uuid[])`,
      );

      // 옵션 금액: 성인 2 + 픽업(건당) + 도시락(1인당 × 2)
      const [optCart] = await as(
        tx,
        A,
        (sp) =>
          sp<
            { id: string }[]
          >`insert into public.cart_items (product_id, slot_id, use_date, adult_qty, option_ids)
           values (${fuji.id}, ${fujiSlot.id}, ${optionDate}, 2, ${[pickup.id, lunch.id]}::uuid[]) returning id`,
      );
      if (!optCart) throw new Error("옵션 담기 실패");
      const optionTotal = fuji.adult_price * 2 + pickup.price + lunch.price * 2;
      await expectError(tx, "A: 옵션 금액을 뺀 금액으로 결제", A, "price_changed", (sp) =>
        booker(sp, [optCart.id], fuji.adult_price * 2),
      );
      const [optOrder] = await as(tx, A, (sp) => booker(sp, [optCart.id], optionTotal));
      const [optItem] = await tx<{ options_amount: number; subtotal: number; n: number }[]>`
        select oi.options_amount, oi.subtotal, (select count(*)::int from public.order_item_options x where x.order_item_id = oi.id) as n
        from public.order_items oi join public.orders o on o.id = oi.order_id where o.order_no = ${optOrder?.order_no ?? ""}`;
      check(
        "옵션 포함 결제 (건당 + 1인당 × 인원)",
        optItem?.options_amount === pickup.price + lunch.price * 2 &&
          optItem.subtotal === optionTotal &&
          optItem.n === 2,
        `옵션 ${optItem?.options_amount?.toLocaleString()}원 · 합계 ${optItem?.subtotal?.toLocaleString()}원 · 옵션 ${optItem?.n}행`,
      );

      // 날짜별 가격 덮어쓰기
      await tx`insert into public.slot_inventory (slot_id, use_date, adult_price) values (${fujiSlot.id}, ${priceDate}, 99000)`;
      const [priceCart] = await as(tx, A, (sp) =>
        addCart(sp, { product_id: fuji.id, slot_id: fujiSlot.id, use_date: priceDate }),
      );
      if (!priceCart) throw new Error("가격 덮어쓰기 담기 실패");
      await expectError(
        tx,
        "A: 기본 가격으로 결제 (덮어쓴 가격과 다름)",
        A,
        "price_changed",
        (sp) => booker(sp, [priceCart.id], fuji.adult_price),
      );
      await expectOk(tx, "A: 날짜별 덮어쓴 가격(99,000원)으로 결제", A, async (sp) => {
        const [r] = await booker(sp, [priceCart.id], 99000);
        return r?.order_no ?? "";
      });

      // 파트너 확정 상품: 확정 대기 · 기한 · 대기 중 취소 100%
      const snorkelDate = await dayPlus(10);
      const [snorkelCart] = await as(tx, A, (sp) =>
        addCart(sp, { product_id: snorkel.id, use_date: snorkelDate }),
      );
      if (!snorkelCart) throw new Error("스노클링 담기 실패");
      const [snorkelOrder] = await as(tx, A, (sp) =>
        booker(sp, [snorkelCart.id], snorkel.adult_price),
      );
      const [pending] = await tx<
        {
          id: string;
          order_id: string;
          status: string;
          voucher_code: string | null;
          deadline_ok: boolean;
        }[]
      >`
        select oi.id, oi.order_id, oi.status::text, oi.voucher_code,
               oi.confirm_deadline <= now() + interval '48 hours'
               and oi.confirm_deadline <= (oi.use_date::timestamp at time zone 'Asia/Seoul') as deadline_ok
        from public.order_items oi join public.orders o on o.id = oi.order_id
        where o.order_no = ${snorkelOrder?.order_no ?? ""}`;
      if (!pending) throw new Error("확정 대기 항목 없음");
      check(
        "파트너 확정 상품 → 확정 대기 · 바우처 없음 · 기한 ≤ 48시간·이용일 0시",
        pending.status === "pending" && pending.voucher_code === null && pending.deadline_ok,
        `${pending.status} · 기한 ${pending.deadline_ok ? "정상" : "✗"}`,
      );
      const [pendingQuote] = await as(
        tx,
        A,
        (sp) =>
          sp<
            { status: string; refund_rate: number }[]
          >`select status, refund_rate from public.refund_quote(${pending.order_id})`,
      );
      check(
        "확정 대기 환불 미리보기 = 100%",
        pendingQuote?.status === "pending" && pendingQuote.refund_rate === 100,
        `${pendingQuote?.status} · ${pendingQuote?.refund_rate}%`,
      );

      // 역할별 주문 항목 읽기: 담당 파트너는 자기 상품 항목만, 주문(총액·예약자)은 못 본다
      const userD = randomUUID();
      await tx`insert into auth.users (id, email, raw_user_meta_data, aud, role)
               values (${userD}, ${`${userD}@rls.test`}, ${sql.json({ name: "검증파트너" })}, 'authenticated', 'authenticated')`;
      await tx`update public.profiles set role = 'partner' where id = ${userD}`;
      await tx`update public.partners set owner_user_id = ${userD} where id = ${snorkel.partner_id}`;
      const D: Role = { name: "authenticated", userId: userD };
      await expectOk(tx, "파트너: 자기 상품의 주문 항목 읽기", D, async (sp) => {
        const rows = await sp`select 1 from public.order_items where id = ${pending.id}`;
        return rows.length === 1 ? "1행" : `✗ ${rows.length}행`;
      });
      await expectBlocked(
        tx,
        "파트너: 그 주문(총액·예약자) 읽기",
        D,
        async (sp) => (await sp`select 1 from public.orders where id = ${pending.order_id}`).length,
      );
      await expectBlocked(
        tx,
        "파트너: 다른 파트너 상품의 주문 항목 읽기",
        D,
        async (sp) => (await sp`select 1 from public.order_items where id = ${capItemA.id}`).length,
      );
      await expectOk(tx, "관리자: 모든 주문 읽기", admin, async (sp) => {
        const rows = await sp`select 1 from public.orders where id = ${pending.order_id}`;
        return rows.length === 1 ? "1행" : `✗ ${rows.length}행`;
      });
      await expectBlocked(
        tx,
        "B: A의 주문 옵션 읽기",
        B,
        async (sp) =>
          (
            await sp`select 1 from public.order_item_options x join public.order_items oi on oi.id = x.order_item_id where oi.order_id = ${pending.order_id}`
          ).length,
      );

      // 재고 쓰기 권한: 예약 인원 카운터는 아무도 직접 못 바꾼다
      const [snorkelSlot] = await tx<{ id: string }[]>`
        select slot_id as id from public.order_items where id = ${pending.id}`;
      if (!snorkelSlot) throw new Error("스노클링 회차 없음");
      await expectBlocked(
        tx,
        "A(고객): 예약 인원 카운터 수정",
        A,
        async (sp) =>
          (await sp`update public.slot_inventory set booked = 0 where slot_id = ${fujiSlot.id}`)
            .count,
      );
      await expectBlocked(
        tx,
        "파트너: 예약 인원 카운터 수정 (컬럼 권한)",
        D,
        async (sp) =>
          (await sp`update public.slot_inventory set booked = 0 where slot_id = ${snorkelSlot.id}`)
            .count,
      );
      await expectError(
        tx,
        "파트너: 예약보다 적은 정원으로 바꾸기",
        D,
        "capacity_below_booked",
        (sp) =>
          sp`update public.slot_inventory set capacity = 0 where slot_id = ${snorkelSlot.id} and use_date = ${snorkelDate}`,
      );
      await expectOk(tx, "파트너: 자기 회차 날짜 마감", D, async (sp) => {
        const r =
          await sp`insert into public.slot_inventory (slot_id, use_date, closed) values (${snorkelSlot.id}, ${await dayPlus(20)}, true)`;
        return `${r.count}행`;
      });
      await expectBlocked(
        tx,
        "파트너: 다른 파트너 회차 재고 수정",
        D,
        async (sp) =>
          (await sp`update public.slot_inventory set closed = true where slot_id = ${fujiSlot.id}`)
            .count,
      );
      await expectBlocked(
        tx,
        "파트너: 다른 파트너 상품에 옵션 추가",
        D,
        async (sp) =>
          (
            await sp`insert into public.product_options (product_id, name, price) values (${fuji.id}, '끼워 넣기', 1)`
          ).count,
      );
      await expectBlocked(
        tx,
        "anon: 재고 행 삭제",
        anon,
        async (sp) =>
          (await sp`delete from public.slot_inventory where slot_id = ${fujiSlot.id}`).count,
      );

      const bookedBeforeCancel = await bookedOf(snorkelSlot.id, snorkelDate);
      await expectOk(tx, "A: 확정 대기 항목 취소 → 전액 환불", A, async (sp) => {
        const [r] = await sp<
          { refund: number }[]
        >`select public.cancel_order_item(${pending.id}) as refund`;
        if (r?.refund !== snorkel.adult_price) throw new Error(`환불 ${r?.refund}`);
        return `환불 ${r.refund.toLocaleString()}원`;
      });
      const [pendingOrder] = await tx<{ status: string; refund_amount: number }[]>`
        select status::text, refund_amount from public.orders where id = ${pending.order_id}`;
      check(
        "모든 항목이 끝나면 주문도 취소 · 환불 합계",
        pendingOrder?.status === "cancelled" &&
          pendingOrder.refund_amount === snorkel.adult_price &&
          (await bookedOf(snorkelSlot.id, snorkelDate)) === bookedBeforeCancel - 1,
        `${pendingOrder?.status} · ${pendingOrder?.refund_amount?.toLocaleString()}원`,
      );

      // 리뷰 자격은 항목 상태를 따른다: 지난 날짜라도 확정 대기·취소 항목으로는 못 쓴다
      const [pendingPast] = await tx<{ id: string }[]>`
        insert into public.orders (order_no, user_id, booker_name, booker_email, booker_phone, total_amount, idempotency_key, policy_agreed_at)
        values (${`TEST-${randomUUID()}`}, ${userB}, '검증B', 'b@rls.test', '010-1234-5678', 10000, ${randomUUID()}, now())
        returning id`;
      if (!pendingPast) throw new Error("지난 확정 대기 주문 생성 실패");
      await insertItem(pendingPast.id, yatai.id, "야타이", dates.past, 10000, "pending");
      await expectBlocked(
        tx,
        "B: 이용일 지난 '확정 대기' 상품에 리뷰",
        B,
        async (sp) =>
          (
            await sp`insert into public.reviews (product_id, rating, content) values (${yatai.id}, 5, '확정 안 된 예약이에요')`
          ).count,
      );

      // ── 파트너 센터 (S4): 상품 저장 · 재고 일괄 수정 · 예약 확정/거절/사용 처리 · 자동 만료
      // 파트너 D = 유키시마 트래블(스노클링 담당), 위 S2 시나리오에서 연결했다
      const [day1, day3, day14, day20, day25] = await Promise.all([
        dayPlus(1),
        dayPlus(3),
        dayPlus(14),
        dayPlus(20),
        dayPlus(25),
      ]);
      const [kyoto] = await tx<{ id: string }[]>`select id from public.cities where slug = 'kyoto'`;
      if (!kyoto) throw new Error("도시 없음");
      const productJson = {
        slug: `rls-partner-${userD.slice(0, 8)}`,
        city_id: kyoto.id,
        category: "tour",
        theme: "culture",
        title: "검증용 파트너 상품",
        summary: "검증용 요약",
        description: "검증용 상품 설명입니다.",
        highlights: ["포인트"],
        adult_price: 30000,
        child_price: null,
        list_adult_price: null,
        operating_days: [1, 2, 3, 4, 5, 6, 7],
        cutoff_days: 1,
        max_qty: 6,
        duration_text: "약 2시간",
        includes: [],
        excludes: [],
        usage_info: [],
        meeting_point: "교토역",
        latitude: 35,
        longitude: 135.7,
        cancel_policy: "standard",
        unavailable_reason: null,
        confirmation_mode: "manual",
        publish: false,
      };
      const images = [{ url: "https://images.unsplash.com/photo-1", alt: "검증 사진" }];
      const slotsJson = [
        { start_time: "09:00", capacity: 5 },
        { start_time: "15:00", capacity: 5 },
      ];
      const optionsJson = [{ name: "픽업", price: 5000, unit: "per_booking" }];
      const saveProduct = (
        sp: Tx,
        id: string | null,
        product: Record<string, unknown>,
        imgs: unknown[],
        slotList: unknown[],
        opts: unknown[] = optionsJson,
      ) => sp<{ id: string }[]>`
        select public.save_product(${id}::uuid, ${JSON.stringify(product)}::text::jsonb, ${JSON.stringify(imgs)}::text::jsonb,
          '[]'::jsonb, ${JSON.stringify(slotList)}::text::jsonb, ${JSON.stringify(opts)}::text::jsonb) as id`;

      const [savedRow] = await as(tx, D, (sp) =>
        saveProduct(sp, null, productJson, images, slotsJson),
      );
      const savedId = savedRow?.id;
      if (!savedId) throw new Error("파트너 상품 저장 실패");
      const [saved] = await tx<
        { partner_id: string; published_at: string | null; slots: number; opts: number }[]
      >`
        select p.partner_id, p.published_at,
               (select count(*)::int from public.product_slots s where s.product_id = p.id and s.active) as slots,
               (select count(*)::int from public.product_options o where o.product_id = p.id and o.active) as opts
        from public.products p where p.id = ${savedId}`;
      check(
        "파트너: 상품·회차·옵션 한 번에 저장 (본인 파트너, 임시 저장)",
        saved?.partner_id === snorkel.partner_id &&
          saved.published_at === null &&
          saved.slots === 2 &&
          saved.opts === 1,
        `회차 ${saved?.slots} · 옵션 ${saved?.opts}`,
      );
      await expectError(tx, "파트너: 허용되지 않은 사진 주소", D, "invalid_images", (sp) =>
        saveProduct(
          sp,
          null,
          { ...productJson, slug: "rls-bad-image" },
          [{ url: "https://evil.example/x.jpg", alt: "x" }],
          slotsJson,
        ),
      );
      await expectError(tx, "파트너: 같은 시간 회차 두 번", D, "invalid_slots", (sp) =>
        saveProduct(sp, null, { ...productJson, slug: "rls-dup-slot" }, images, [
          { start_time: "09:00", capacity: 5 },
          { start_time: "09:00", capacity: 3 },
        ]),
      );
      await expectError(tx, "파트너: 다른 파트너 상품 수정", D, "not_found", (sp) =>
        saveProduct(sp, fuji.id, productJson, images, slotsJson),
      );
      await expectError(tx, "고객: 상품 저장 함수", B, "forbidden", (sp) =>
        saveProduct(sp, null, { ...productJson, slug: "rls-customer" }, images, slotsJson),
      );
      await expectOk(
        tx,
        "파트너: 회차 하나 빼고 공개로 수정 → 뺀 회차는 판매만 끔",
        D,
        async (sp) => {
          await saveProduct(
            sp,
            savedId,
            { ...productJson, publish: true },
            images,
            [slotsJson[0]],
            [],
          );
          return "저장";
        },
      );
      const [afterEdit] = await tx<
        { active: number; total: number; opts: number; published: boolean }[]
      >`
        select (select count(*)::int from public.product_slots s where s.product_id = ${savedId} and s.active) as active,
               (select count(*)::int from public.product_slots s where s.product_id = ${savedId}) as total,
               (select count(*)::int from public.product_options o where o.product_id = ${savedId} and o.active) as opts,
               (select published_at is not null from public.products where id = ${savedId}) as published`;
      check(
        "수정 후: 회차 1개 판매(1개는 꺼짐, 지우지 않음) · 옵션 꺼짐 · 공개",
        afterEdit?.active === 1 &&
          afterEdit.total === 2 &&
          afterEdit.opts === 0 &&
          afterEdit.published,
        `판매 ${afterEdit?.active}/${afterEdit?.total} · 옵션 ${afterEdit?.opts}`,
      );

      // 재고 일괄 수정
      const [savedSlot] = await tx<{ id: string }[]>`
        select id from public.product_slots where product_id = ${savedId} and active limit 1`;
      if (!savedSlot) throw new Error("저장한 회차 없음");
      const [ranged] = await as(
        tx,
        D,
        (sp) =>
          sp<{ n: number }[]>`select public.set_inventory_range(${savedSlot.id}, ${day1}::date,
          ${day14}::date, '{6,7}'::smallint[], 3, false, 35000, null) as n`,
      );
      check(
        "파트너: 2주 중 주말만 정원 3·가격 35,000원",
        (ranged?.n ?? 0) >= 4 && (ranged?.n ?? 0) <= 6,
        `${ranged?.n}일`,
      );
      await expectError(
        tx,
        "파트너: 다른 파트너 회차 재고 일괄 수정",
        D,
        "not_found",
        (sp) =>
          sp`select public.set_inventory_range(${fujiSlot.id}, ${day1}::date, ${day3}::date, null, 1, false, null, null)`,
      );
      await expectError(
        tx,
        "파트너: 지난 날짜 포함 기간",
        D,
        "invalid_range",
        (sp) =>
          sp`select public.set_inventory_range(${savedSlot.id}, ${dates.past}::date, ${day3}::date, null, 1, false, null, null)`,
      );

      // 예약 처리: A가 스노클링(파트너 확정)을 세 번 예약 → 확정 / 거절 / 기한 지나 자동 취소
      const snorkelOrders: { itemId: string; slotId: string; useDate: string }[] = [];
      for (const n of [21, 22, 23, 24]) {
        const useDate = await dayPlus(n);
        const [cart] = await as(tx, A, (sp) =>
          addCart(sp, { product_id: snorkel.id, use_date: useDate }),
        );
        if (!cart) throw new Error("스노클링 담기 실패");
        const [placed2] = await as(tx, A, (sp) => booker(sp, [cart.id], snorkel.adult_price));
        const [item] = await tx<{ id: string; slot_id: string }[]>`
          select oi.id, oi.slot_id from public.order_items oi join public.orders o on o.id = oi.order_id
          where o.order_no = ${placed2?.order_no ?? ""}`;
        if (!item) throw new Error("스노클링 주문 실패");
        snorkelOrders.push({ itemId: item.id, slotId: item.slot_id, useDate });
      }
      const [toConfirm, toReject, toExpire, lateConfirm] = snorkelOrders as [
        (typeof snorkelOrders)[number],
        (typeof snorkelOrders)[number],
        (typeof snorkelOrders)[number],
        (typeof snorkelOrders)[number],
      ];

      await expectOk(tx, "파트너: 예약 목록(예약자 연락처 포함)", D, async (sp) => {
        const rows = await sp<{ item_id: string; booker_name: string }[]>`
          select item_id, booker_name from public.partner_bookings(${day20}::date, ${day25}::date)`;
        const mine = rows.filter((r) => snorkelOrders.some((o) => o.itemId === r.item_id));
        if (mine.length !== 4 || mine[0]?.booker_name !== "검증")
          throw new Error(`${mine.length}건`);
        return `${mine.length}건 · 예약자 ${mine[0].booker_name}`;
      });
      await expectBlocked(
        tx,
        "고객: 파트너 예약 목록",
        B,
        async (sp) =>
          (await sp`select 1 from public.partner_bookings(${day20}::date, ${day25}::date)`).length,
      );
      await expectError(
        tx,
        "고객: 예약 확정 함수",
        A,
        "forbidden",
        (sp) => sp`select public.confirm_item(${toConfirm.itemId})`,
      );
      const [confirmed] = await as(
        tx,
        D,
        (sp) => sp<{ r: string }[]>`select public.confirm_item(${toConfirm.itemId}) as r`,
      );
      const [voucher] = await tx<{ status: string; voucher_code: string | null }[]>`
        select status::text, voucher_code from public.order_items where id = ${toConfirm.itemId}`;
      check(
        "파트너: 확정 → 바우처 발급",
        confirmed?.r === "confirmed" &&
          voucher?.status === "confirmed" &&
          Boolean(voucher.voucher_code),
        `${voucher?.status} · ${voucher?.voucher_code}`,
      );
      await expectError(
        tx,
        "파트너: 이미 확정한 예약 다시 확정",
        D,
        "not_pending",
        (sp) => sp`select public.confirm_item(${toConfirm.itemId})`,
      );
      const code = voucher?.voucher_code ?? "";
      await expectError(
        tx,
        "파트너: 이용일 전 바우처 사용 처리",
        D,
        "not_use_date",
        (sp) => sp`select * from public.mark_used(${code})`,
      );
      // 이용일이 된 상황을 만든다 (검증용으로 이용일만 오늘로)
      await tx`update public.order_items set use_date = public.seoul_today() where id = ${toConfirm.itemId}`;
      await expectError(
        tx,
        "다른 파트너 계정으로 바우처 사용 처리",
        admin,
        "forbidden",
        (sp) => sp`select * from public.mark_used(${code})`,
      );
      await expectOk(tx, "파트너: 바우처 사용 처리 (소문자·하이픈 입력도 인식)", D, async (sp) => {
        const formatted = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();
        const [r] = await sp<
          { product_title: string }[]
        >`select * from public.mark_used(${formatted})`;
        return r?.product_title ?? "";
      });
      await expectError(
        tx,
        "파트너: 같은 바우처 두 번 사용",
        D,
        "already_used",
        (sp) => sp`select * from public.mark_used(${code})`,
      );

      await expectError(
        tx,
        "파트너: 사유 없이 거절",
        D,
        "invalid_reason",
        (sp) => sp`select public.reject_item(${toReject.itemId}, '')`,
      );
      const bookedBeforeReject = await bookedOf(toReject.slotId, toReject.useDate);
      await expectOk(tx, "파트너: 예약 거절", D, async (sp) => {
        await sp`select public.reject_item(${toReject.itemId}, '해당 날짜 선박 점검')`;
        return "거절";
      });
      const [rejected] = await tx<{ status: string; refund_amount: number; trip_left: number }[]>`
        select oi.status::text, oi.refund_amount,
               (select count(*)::int from public.trip_items ti where ti.order_item_id = oi.id) as trip_left
        from public.order_items oi where oi.id = ${toReject.itemId}`;
      check(
        "거절 → 전액 환불 · 좌석 반환 · 플래너 항목 삭제",
        rejected?.status === "rejected" &&
          rejected.refund_amount === snorkel.adult_price &&
          rejected.trip_left === 0 &&
          (await bookedOf(toReject.slotId, toReject.useDate)) === bookedBeforeReject - 1,
        `${rejected?.status} · 환불 ${rejected?.refund_amount?.toLocaleString()}원`,
      );

      // 기한 지난 확정 대기: 자동 만료 함수(로그인 사용자 누구나 호출 가능) → 전액 환불
      await tx`update public.order_items set confirm_deadline = now() - interval '1 minute'
               where id in (${toExpire.itemId}, ${lateConfirm.itemId})`;
      const [lateResult] = await as(
        tx,
        D,
        (sp) => sp<{ r: string }[]>`select public.confirm_item(${lateConfirm.itemId}) as r`,
      );
      check(
        "기한 지난 뒤 확정 시도 → 확정 대신 자동 취소",
        lateResult?.r === "expired",
        lateResult?.r ?? "",
      );
      const [expiredCount] = await as(
        tx,
        B,
        (sp) => sp<{ n: number }[]>`select public.expire_pending_items() as n`,
      );
      const [expired] = await tx<{ status: string; refund_amount: number }[]>`
        select status::text, refund_amount from public.order_items where id = ${toExpire.itemId}`;
      check(
        "자동 만료 → 기한 초과 취소 · 전액 환불",
        (expiredCount?.n ?? 0) >= 1 &&
          expired?.status === "expired" &&
          expired.refund_amount === snorkel.adult_price,
        `${expiredCount?.n}건 · ${expired?.status}`,
      );
      await expectBlocked(
        tx,
        "anon: 자동 만료 함수",
        anon,
        async (sp) => (await sp`select public.expire_pending_items()`).count,
      );

      // Storage: 파트너 폴더에만 상품 사진 업로드
      await expectOk(tx, "파트너: 내 파트너 폴더에 상품 사진 업로드", D, async (sp) => {
        const r =
          await sp`insert into storage.objects (bucket_id, name) values ('product-images', ${`${snorkel.partner_id}/rls.webp`})`;
        return `${r.count}행`;
      });
      await expectBlocked(
        tx,
        "파트너: 다른 파트너 폴더에 업로드",
        D,
        async (sp) =>
          (
            await sp`insert into storage.objects (bucket_id, name) values ('product-images', ${`00000000-0000-4000-8000-000000000011/rls.webp`})`
          ).count,
      );
      await expectBlocked(
        tx,
        "고객: 상품 사진 업로드",
        B,
        async (sp) =>
          (
            await sp`insert into storage.objects (bucket_id, name) values ('product-images', ${`${userB}/rls.webp`})`
          ).count,
      );

      // ── 정산 (S5): 지난달 항목 상태별 고정 데이터 → 정확한 금액, 파트너 격리, 관리자 정산 완료(스냅숏)
      // 새 파트너 E(수수료 15%)에 지난달 이용 항목을 관리자 권한으로 직접 넣는다
      const userE = randomUUID();
      await tx`insert into auth.users (id, email, raw_user_meta_data, aud, role)
               values (${userE}, ${`${userE}@rls.test`}, ${sql.json({ name: "검증정산" })}, 'authenticated', 'authenticated')`;
      await tx`update public.profiles set role = 'partner' where id = ${userE}`;
      const [partnerE] = await tx<{ id: string }[]>`
        insert into public.partners (owner_user_id, name, contact_name, contact_phone, contact_email, intro, commission_rate)
        values (${userE}, '검증 정산 파트너', '검증', '02-000-0000', 'e@rls.test', '정산 검증용 파트너', 15)
        returning id`;
      if (!partnerE) throw new Error("정산 파트너 생성 실패");
      const E: Role = { name: "authenticated", userId: userE };
      const [months] = await tx<{ last: string; current: string }[]>`
        select (date_trunc('month', public.seoul_today()) - interval '1 month')::date::text as last,
               date_trunc('month', public.seoul_today())::date::text as current`;
      if (!months) throw new Error("월 계산 실패");
      const [settleOrder] = await tx<{ id: string }[]>`
        insert into public.orders (order_no, user_id, booker_name, booker_email, booker_phone, total_amount, idempotency_key, policy_agreed_at)
        values (${`TEST-${randomUUID()}`}, ${userA}, '검증A', 'a@rls.test', '010-1234-5678', 70000, ${randomUUID()}, now())
        returning id`;
      if (!settleOrder) throw new Error("정산 주문 생성 실패");
      // [상태, 결제액, 환불액] — 기대: 이용 완료 10,000 + 확정(지난 날) 20,000 + 일부 환불 취소 5,000 = 매출 35,000
      //   거절·만료·전액 환불 취소는 제외 → 수수료 1,500 + 3,000 + 750 = 5,250 → 지급 29,750
      const settleFixture: [string, number, number | null][] = [
        ["used", 10000, null],
        ["confirmed", 20000, null],
        ["cancelled", 10000, 5000],
        ["cancelled", 10000, 10000],
        ["rejected", 10000, 10000],
        ["expired", 10000, 10000],
      ];
      for (const [i, [status, subtotal, refund]] of settleFixture.entries()) {
        await tx`
          insert into public.order_items (order_id, product_id, product_title, use_date, adult_qty, child_qty,
            adult_price, subtotal, refund_amount, cancel_policy, slot_id, partner_id, commission_rate, status)
          values (${settleOrder.id}, ${fuji.id}, ${`정산 ${status}`}, ${months.last}::date + ${i}::int, 1, 0,
            ${subtotal}, ${subtotal}, ${refund}, 'standard', ${fujiSlot.id}, ${partnerE.id}, 15,
            ${status}::public.order_item_status)`;
      }
      type SummaryRow = {
        partner_id: string;
        item_count: number;
        revenue: number;
        commission: number;
        payout: number;
        settled_at: string | null;
      };
      const [summaryE] = await as(
        tx,
        E,
        (sp) =>
          sp<
            SummaryRow[]
          >`select * from public.settlement_summary(null, ${months.last}::date, ${months.last}::date)`,
      );
      check(
        "정산: 상태별 매출·수수료·지급액 (35,000 · 5,250 · 29,750)",
        summaryE?.item_count === 3 &&
          summaryE.revenue === 35000 &&
          summaryE.commission === 5250 &&
          summaryE.payout === 29750 &&
          summaryE.settled_at === null,
        `${summaryE?.item_count}건 · 매출 ${summaryE?.revenue} · 수수료 ${summaryE?.commission} · 지급 ${summaryE?.payout}`,
      );
      await expectOk(tx, "파트너: 다른 파트너 id를 넘겨도 자기 정산만", E, async (sp) => {
        const rows = await sp<{ partner_id: string }[]>`
          select partner_id from public.settlement_summary(${snorkel.partner_id}, ${months.last}::date, ${months.last}::date)`;
        if (rows.some((r) => r.partner_id !== partnerE.id))
          throw new Error("다른 파트너 행이 보임");
        return `${rows.length}행 (모두 본인)`;
      });
      await expectBlocked(
        tx,
        "다른 파트너 D: E의 정산 항목 보기",
        D,
        async (sp) =>
          (
            await sp`select 1 from public.settlement_items(null, ${months.last}::date, ${months.last}::date) where partner_id = ${partnerE.id}`
          ).length,
      );
      await expectError(
        tx,
        "고객: 정산 조회",
        B,
        "forbidden",
        (sp) =>
          sp`select * from public.settlement_summary(null, ${months.last}::date, ${months.last}::date)`,
      );
      await expectError(
        tx,
        "파트너: 정산 완료 처리",
        E,
        "forbidden",
        (sp) => sp`select public.admin_settle_month(${partnerE.id}, ${months.last}::date)`,
      );
      await expectError(
        tx,
        "관리자: 이번 달(안 끝난 달) 정산",
        admin,
        "month_not_ended",
        (sp) => sp`select public.admin_settle_month(${partnerE.id}, ${months.current}::date)`,
      );
      await expectOk(tx, "관리자: 지난달 정산 완료 처리", admin, async (sp) => {
        const [r] = await sp<
          { payout: number }[]
        >`select public.admin_settle_month(${partnerE.id}, ${months.last}::date) as payout`;
        if (r?.payout !== 29750) throw new Error(`지급액 ${r?.payout}`);
        return `지급 ${r.payout.toLocaleString()}원`;
      });
      await expectError(
        tx,
        "관리자: 같은 달 두 번 정산",
        admin,
        "already_settled",
        (sp) => sp`select public.admin_settle_month(${partnerE.id}, ${months.last}::date)`,
      );
      // 정산 후 항목이 바뀌어도(검증용으로 직접 수정) 정산 완료 숫자는 그대로
      await tx`update public.order_items set refund_amount = 0 where order_id = ${settleOrder.id} and status = 'cancelled'`;
      const [frozen] = await as(
        tx,
        E,
        (sp) =>
          sp<
            SummaryRow[]
          >`select * from public.settlement_summary(null, ${months.last}::date, ${months.last}::date)`,
      );
      check(
        "정산 완료 후에는 고정된 숫자 (항목이 바뀌어도 그대로)",
        frozen?.revenue === 35000 && frozen.settled_at !== null,
        `매출 ${frozen?.revenue} · 완료 ${frozen?.settled_at ? "예" : "아니오"}`,
      );
      await expectBlocked(
        tx,
        "다른 파트너 D: E의 정산 기록 읽기",
        D,
        async (sp) =>
          (await sp`select 1 from public.settlements where partner_id = ${partnerE.id}`).length,
      );
      await expectBlocked(
        tx,
        "파트너: 정산 기록 직접 수정",
        E,
        async (sp) =>
          (await sp`update public.settlements set payout = 0 where partner_id = ${partnerE.id}`)
            .count,
      );

      // ── 관리자 콘솔 (S6): 리뷰 신고·숨김 · 상품 판매 중지 · 통계
      const [reportB] = await as(
        tx,
        B,
        (sp) =>
          sp<{ id: string }[]>`insert into public.review_reports (review_id, reason, detail)
          values (${reviewA.id}, 'spam', '광고 같아요') returning id`,
      );
      check("B: 다른 사람 리뷰 신고", Boolean(reportB), reportB ? "1건" : "실패");
      if (!reportB) throw new Error("신고 실패");
      await expectError(
        tx,
        "B: 같은 리뷰 두 번 신고",
        B,
        "already_reported",
        (sp) =>
          sp`insert into public.review_reports (review_id, reason) values (${reviewA.id}, 'abuse')`,
      );
      await expectError(
        tx,
        "A: 본인 리뷰 신고",
        A,
        "own_review",
        (sp) =>
          sp`insert into public.review_reports (review_id, reason) values (${reviewA.id}, 'other')`,
      );
      await expectBlocked(
        tx,
        "A: 남이 한 신고 읽기",
        A,
        async (sp) =>
          (await sp`select 1 from public.review_reports where id = ${reportB.id}`).length,
      );
      await expectBlocked(
        tx,
        "B: 신고 상태를 처리 완료로 (컬럼 권한)",
        B,
        async (sp) =>
          (await sp`update public.review_reports set status = 'actioned' where id = ${reportB.id}`)
            .count,
      );
      await expectError(
        tx,
        "B: 신고 처리 함수",
        B,
        "forbidden",
        (sp) => sp`select public.resolve_review_report(${reportB.id}, 'hide', '광고')`,
      );
      const [ratingBefore] = await tx<{ review_count: number }[]>`
        select review_count from public.products where id = ${tea.id}`;
      await expectError(
        tx,
        "관리자: 사유 없이 신고 처리",
        admin,
        "invalid_note",
        (sp) => sp`select public.resolve_review_report(${reportB.id}, 'hide', '')`,
      );
      await expectOk(tx, "관리자: 신고 처리 → 리뷰 숨김", admin, async (sp) => {
        await sp`select public.resolve_review_report(${reportB.id}, 'hide', '광고성 리뷰 확인')`;
        return "숨김";
      });
      await expectBlocked(
        tx,
        "anon: 숨긴 리뷰 보기",
        anon,
        async (sp) => (await sp`select 1 from public.reviews where id = ${reviewA.id}`).length,
      );
      await expectBlocked(
        tx,
        "B: 숨긴 리뷰 보기",
        B,
        async (sp) => (await sp`select 1 from public.reviews where id = ${reviewA.id}`).length,
      );
      await expectOk(tx, "작성자 A: 숨긴 본인 리뷰 보기", A, async (sp) => {
        const rows = await sp`select 1 from public.reviews where id = ${reviewA.id}`;
        return rows.length === 1 ? "1행" : `✗ ${rows.length}행`;
      });
      await expectOk(tx, "관리자: 숨긴 리뷰 보기", admin, async (sp) => {
        const rows = await sp`select 1 from public.reviews where id = ${reviewA.id}`;
        return rows.length === 1 ? "1행" : `✗ ${rows.length}행`;
      });
      const [ratingAfter] = await tx<{ review_count: number }[]>`
        select review_count from public.products where id = ${tea.id}`;
      check(
        "숨긴 리뷰는 평점·리뷰 수 집계에서 빠짐",
        (ratingAfter?.review_count ?? -1) === (ratingBefore?.review_count ?? 0) - 1,
        `${ratingBefore?.review_count} → ${ratingAfter?.review_count}`,
      );
      await expectError(
        tx,
        "관리자: 처리한 신고 다시 처리",
        admin,
        "not_pending",
        (sp) => sp`select public.resolve_review_report(${reportB.id}, 'dismiss', '중복')`,
      );
      await expectOk(tx, "관리자: 숨김 해제 → 다시 공개", admin, async (sp) => {
        await sp`select public.admin_set_review_hidden(${reviewA.id}, false, '재검토 결과 문제 없음')`;
        return "해제";
      });
      await expectOk(tx, "anon: 숨김 해제된 리뷰 보기", anon, async (sp) => {
        const rows = await sp`select 1 from public.reviews where id = ${reviewA.id}`;
        return rows.length === 1 ? "1행" : `✗ ${rows.length}행`;
      });

      // 상품 판매 중지: 중지되면 예약(장바구니 담기)이 막히고, 재개하면 다시 된다
      await expectError(
        tx,
        "파트너 D: 상품 판매 중지 함수",
        D,
        "forbidden",
        (sp) =>
          sp`select public.admin_set_product_suspension(${fuji.id}, true, 'info_fix', '점검')`,
      );
      await expectOk(tx, "관리자: 상품 판매 중지", admin, async (sp) => {
        await sp`select public.admin_set_product_suspension(${fuji.id}, true, 'info_fix', '안전 점검 중')`;
        return "중지";
      });
      const suspendDate = await dayPlus(30);
      await expectError(
        tx,
        "중지된 상품 담기",
        B,
        "unavailable",
        (sp) =>
          sp`insert into public.cart_items (product_id, use_date) values (${fuji.id}, ${suspendDate})`,
      );
      await expectOk(tx, "관리자: 판매 재개 → 다시 담기 가능", admin, async (sp) => {
        await sp`select public.admin_set_product_suspension(${fuji.id}, false, null, '점검 완료')`;
        return "재개";
      });
      await expectOk(tx, "재개된 상품 담기", B, async (sp) => {
        const r =
          await sp`insert into public.cart_items (product_id, use_date) values (${fuji.id}, ${suspendDate})`;
        return `${r.count}행`;
      });

      // 통계: 관리자만
      await expectError(
        tx,
        "고객: 대시보드 통계",
        B,
        "forbidden",
        (sp) =>
          sp`select * from public.admin_kpis(public.seoul_today() - 30, public.seoul_today())`,
      );
      await expectError(
        tx,
        "파트너: 대시보드 통계",
        D,
        "forbidden",
        (sp) =>
          sp`select * from public.admin_daily_stats(public.seoul_today() - 30, public.seoul_today())`,
      );
      await expectOk(tx, "관리자: 30일 일별 통계", admin, async (sp) => {
        const rows =
          await sp`select * from public.admin_daily_stats(public.seoul_today() - 29, public.seoul_today())`;
        if (rows.length !== 30) throw new Error(`${rows.length}일`);
        return `${rows.length}일`;
      });

      // ── 감사 로그 (관리자 개선 S1): 트리거가 누가 · 무엇을 했는지 남긴다
      const auditOf = (entityId: string, action: string) =>
        tx<{ actor_role: string; actor_id: string | null; reason: string | null }[]>`
          select actor_role, actor_id, reason from public.audit_logs
          where entity_id = ${entityId} and action = ${action}`;
      const [cancelLog] = await auditOf(capItemA.id, "item.cancelled");
      check(
        "감사 로그: 고객 취소 → 고객 · 본인 계정 (파트너로 승인된 계정이 산 주문이어도)",
        cancelLog?.actor_role === "customer" && cancelLog.actor_id === userA,
        `${cancelLog?.actor_role ?? "없음"}`,
      );
      const [instantLog] = await auditOf(capItemA.id, "item.confirmed");
      check(
        "감사 로그: 즉시 확정 → 시스템",
        instantLog?.actor_role === "system",
        `${instantLog?.actor_role ?? "없음"}`,
      );
      const [rejectLog] = await auditOf(toReject.itemId, "item.rejected");
      check(
        "감사 로그: 파트너 거절 → 파트너 계정 · 사유",
        rejectLog?.actor_role === "partner" &&
          rejectLog.actor_id === userD &&
          rejectLog.reason === "해당 날짜 선박 점검",
        `${rejectLog?.actor_role ?? "없음"} · ${rejectLog?.reason ?? ""}`,
      );
      const expireLogs = [
        ...(await auditOf(toExpire.itemId, "item.expired")),
        ...(await auditOf(lateConfirm.itemId, "item.expired")),
      ];
      check(
        "감사 로그: 기한 초과 만료 → 실행한 사람과 무관하게 시스템",
        expireLogs.length === 2 &&
          expireLogs.every((l) => l.actor_role === "system" && l.actor_id === null),
        expireLogs.map((l) => l.actor_role).join(", "),
      );
      const [suspendLog] = await auditOf(fuji.id, "product.suspend");
      check(
        "감사 로그: 판매 중지 → 관리자 · 사유",
        suspendLog?.actor_role === "admin" && suspendLog.reason === "안전 점검 중",
        `${suspendLog?.actor_role ?? "없음"} · ${suspendLog?.reason ?? ""}`,
      );
      await expectOk(tx, "관리자: 감사 로그 읽기", admin, async (sp) => {
        const rows = await sp`select 1 from public.audit_logs where entity_id = ${capItemA.id}`;
        if (rows.length < 2) throw new Error(`${rows.length}행`);
        return `${rows.length}행`;
      });
      await expectBlocked(
        tx,
        "고객: 본인 주문 감사 로그 읽기",
        A,
        async (sp) =>
          (await sp`select 1 from public.audit_logs where entity_id = ${capItemA.id}`).length,
      );
      await expectBlocked(
        tx,
        "파트너: 감사 로그 읽기",
        D,
        async (sp) =>
          (await sp`select 1 from public.audit_logs where entity_id = ${toReject.itemId}`).length,
      );
      await expectBlocked(
        tx,
        "관리자: 감사 로그 직접 쓰기",
        admin,
        async (sp) =>
          (
            await sp`insert into public.audit_logs (actor_role, entity, entity_id, action)
                     values ('system', 'order', ${capItemA.id}, 'order.paid')`
          ).count,
      );
      await expectBlocked(
        tx,
        "관리자: 감사 로그 고치기",
        admin,
        async (sp) =>
          (await sp`update public.audit_logs set reason = 'x' where entity_id = ${capItemA.id}`)
            .count,
      );
      await expectBlocked(
        tx,
        "기록 헬퍼 직접 호출",
        admin,
        async (sp) =>
          (await sp`select public.write_audit('order', ${capItemA.id}, null, 'order.paid')`).count,
      );

      // ── 관리자 주문 처리 (관리자 개선 S2): 운영자 취소 · 환불 조정 · 조정 전표 · CS 메모
      // A의 주문에 후지산(일반 취소 규정, 3만 원) 항목 4개: 10일 뒤 · 4일 뒤 · 오늘 · 지난 날
      const [opsOrder] = await tx<{ id: string }[]>`
        insert into public.orders (order_no, user_id, booker_name, booker_email, booker_phone, total_amount, idempotency_key, policy_agreed_at)
        values (${`TEST-${randomUUID()}`}, ${userA}, '검증A', 'a@rls.test', '010-1234-5678', 120000, ${randomUUID()}, now())
        returning id`;
      if (!opsOrder) throw new Error("운영 주문 생성 실패");
      const opsItem = async (useDate: string) => {
        const [row] = await tx<{ id: string }[]>`
          insert into public.order_items (order_id, product_id, product_title, use_date, adult_qty, child_qty,
            adult_price, subtotal, cancel_policy, slot_id, partner_id, commission_rate, status)
          select ${opsOrder.id}, p.id, '운영 검증', ${useDate}::date, 1, 0, 30000, 30000, 'standard',
            ${fujiSlot.id}, p.partner_id, 15, 'confirmed'
          from public.products p where p.id = ${fuji.id}
          returning id`;
        // 직접 넣은 항목도 좌석 카운터를 맞춘다 (booked = 살아 있는 항목 인원 합)
        await tx`insert into public.slot_inventory (slot_id, use_date, booked) values (${fujiSlot.id}, ${useDate}::date, 1)
                 on conflict (slot_id, use_date) do update set booked = public.slot_inventory.booked + 1`;
        if (!row) throw new Error("운영 항목 생성 실패");
        return row.id;
      };
      const opsFar = await opsItem(await dayPlus(10));
      const opsNear = await opsItem(await dayPlus(4));
      const opsToday = await opsItem(dates.today);
      const opsPast = await opsItem(dates.past);

      await expectError(
        tx,
        "고객: 운영자 취소 함수",
        A,
        "forbidden",
        (sp) => sp`select public.admin_cancel_item(${opsFar}, 'weather', '태풍')`,
      );
      await expectError(
        tx,
        "파트너: 운영자 취소 함수",
        D,
        "forbidden",
        (sp) => sp`select public.admin_cancel_item(${opsFar}, 'weather', '태풍')`,
      );
      await expectError(
        tx,
        "관리자: 모르는 취소 사유 코드",
        admin,
        "invalid_cancel_reason",
        (sp) => sp`select public.admin_cancel_item(${opsFar}, 'whatever', '태풍')`,
      );
      await expectError(
        tx,
        "관리자: 고객 안내 없이 운영자 취소",
        admin,
        "invalid_cancel_note",
        (sp) => sp`select public.admin_cancel_item(${opsFar}, 'weather', '  ')`,
      );
      const farDate = await dayPlus(10);
      const bookedBeforeOps = await bookedOf(fujiSlot.id, farDate);
      await expectOk(tx, "관리자: 기상 사유 운영자 취소 → 전액 환불", admin, async (sp) => {
        const [r] = await sp<{ refund: number }[]>`
          select public.admin_cancel_item(${opsFar}, 'weather', '태풍 접근으로 운항 취소') as refund`;
        if (r?.refund !== 30000) throw new Error(`환불 ${r?.refund}`);
        return `환불 ${r.refund.toLocaleString()}원`;
      });
      const [farRow] = await tx<{ status: string; cancel_reason: string | null }[]>`
        select status::text, cancel_reason from public.order_items where id = ${opsFar}`;
      check(
        "운영자 취소: 취소 상태 · 고객에게 보일 사유 · 좌석 반환",
        farRow?.status === "cancelled" &&
          farRow.cancel_reason === "기상·천재지변 — 태풍 접근으로 운항 취소" &&
          (await bookedOf(fujiSlot.id, farDate)) === bookedBeforeOps - 1,
        `${farRow?.status} · ${farRow?.cancel_reason}`,
      );
      const [opsLog] = await tx<{ actor_role: string; reason_code: string | null }[]>`
        select actor_role, reason_code from public.audit_logs
        where entity_id = ${opsFar} and action = 'item.cancelled'`;
      check(
        "감사 로그: 운영자 취소 → 관리자 · 사유 코드",
        opsLog?.actor_role === "admin" && opsLog.reason_code === "weather",
        `${opsLog?.actor_role} · ${opsLog?.reason_code}`,
      );
      await expectOk(
        tx,
        "관리자: 고객 요청 대행 → 취소 규정대로 (4일 전 50%)",
        admin,
        async (sp) => {
          const [r] = await sp<{ refund: number }[]>`
          select public.admin_cancel_item(${opsNear}, 'customer_request', '고객 전화 요청') as refund`;
          if (r?.refund !== 15000) throw new Error(`환불 ${r?.refund}`);
          return `환불 ${r.refund.toLocaleString()}원`;
        },
      );
      await expectError(
        tx,
        "관리자: 이용일 당일 고객 요청 대행",
        admin,
        "not_cancellable",
        (sp) => sp`select public.admin_cancel_item(${opsToday}, 'customer_request', '요청')`,
      );
      await expectOk(tx, "관리자: 이용일 당일 기상 취소 → 전액", admin, async (sp) => {
        const [r] = await sp<{ refund: number }[]>`
          select public.admin_cancel_item(${opsToday}, 'weather', '당일 폭우') as refund`;
        if (r?.refund !== 30000) throw new Error(`환불 ${r?.refund}`);
        return `환불 ${r.refund.toLocaleString()}원`;
      });
      await expectError(
        tx,
        "관리자: 지난 날 항목 운영자 취소",
        admin,
        "not_cancellable",
        (sp) => sp`select public.admin_cancel_item(${opsPast}, 'partner_operation', '사정')`,
      );
      await expectError(
        tx,
        "관리자: 이미 취소한 항목 다시 취소",
        admin,
        "already_cancelled",
        (sp) => sp`select public.admin_cancel_item(${opsFar}, 'weather', '다시')`,
      );

      // 환불 조정: 끝난 항목만, 늘리기만
      await expectError(
        tx,
        "고객: 환불 조정 함수",
        A,
        "forbidden",
        (sp) => sp`select public.admin_adjust_refund(${opsNear}, 30000, '면제')`,
      );
      await expectError(
        tx,
        "관리자: 사유 없이 환불 조정",
        admin,
        "invalid_adjust_reason",
        (sp) => sp`select public.admin_adjust_refund(${opsNear}, 30000, '')`,
      );
      await expectError(
        tx,
        "관리자: 환불 줄이기",
        admin,
        "invalid_amount",
        (sp) => sp`select public.admin_adjust_refund(${opsNear}, 10000, '감액')`,
      );
      await expectError(
        tx,
        "관리자: 결제액보다 많이 환불",
        admin,
        "invalid_amount",
        (sp) => sp`select public.admin_adjust_refund(${opsNear}, 30001, '초과')`,
      );
      await expectOk(tx, "관리자: 취소 수수료 면제 (1.5만 → 3만)", admin, async (sp) => {
        const [r] = await sp<{ refund: number }[]>`
          select public.admin_adjust_refund(${opsNear}, 30000, '질병 진단서 확인 — 수수료 면제') as refund`;
        return `환불 ${r?.refund.toLocaleString()}원`;
      });
      const [opsOrderRow] = await tx<{ refund_amount: number }[]>`
        select refund_amount from public.orders where id = ${opsOrder.id}`;
      const [adjRow] = await tx<{ before_amount: number; after_amount: number }[]>`
        select before_amount, after_amount from public.refund_adjustments where order_item_id = ${opsNear}`;
      check(
        "환불 조정: 주문 환불 합계 · 조정 기록 (3만 + 3만 + 3만)",
        opsOrderRow?.refund_amount === 90000 &&
          adjRow?.before_amount === 15000 &&
          adjRow.after_amount === 30000,
        `주문 환불 ${opsOrderRow?.refund_amount} · ${adjRow?.before_amount} → ${adjRow?.after_amount}`,
      );
      await expectError(
        tx,
        "관리자: 지난 날 확정 항목 전액 환불 뒤 다시 조정",
        admin,
        "invalid_amount",
        async (sp) => {
          await sp`select public.admin_adjust_refund(${opsPast}, 30000, '현장 미운영 확인')`;
          return sp`select public.admin_adjust_refund(${opsPast}, 30000, '중복')`;
        },
      );
      const [notAdjustable] = await tx<{ id: string }[]>`
        insert into public.order_items (order_id, product_id, product_title, use_date, adult_qty, child_qty,
          adult_price, subtotal, cancel_policy, slot_id, partner_id, commission_rate, status)
        select ${opsOrder.id}, p.id, '미래 확정', public.seoul_today() + 20, 1, 0, 10000, 10000, 'standard',
          ${fujiSlot.id}, p.partner_id, 15, 'confirmed'
        from public.products p where p.id = ${fuji.id}
        returning id`;
      await expectError(
        tx,
        "관리자: 이용 전 확정 항목 환불 조정 (운영자 취소로)",
        admin,
        "not_adjustable",
        (sp) => sp`select public.admin_adjust_refund(${notAdjustable?.id ?? null}, 5000, '선환불')`,
      );

      // 정산 완료된 달(E의 지난달, 지급 29,750)의 이용 완료 항목 1만 원에 4천 원 환불
      // → 지난달 숫자 그대로, 이번 달에 매출 −4,000 · 수수료 −600(1,500 → 900) 조정 전표
      const [usedE] = await tx<{ id: string }[]>`
        select id from public.order_items where order_id = ${settleOrder.id} and status::text = 'used'`;
      if (!usedE) throw new Error("정산 항목 없음");
      await expectOk(tx, "관리자: 정산 완료 달 항목 환불 조정", admin, async (sp) => {
        await sp`select public.admin_adjust_refund(${usedE.id}, 4000, '현장 일부 프로그램 취소')`;
        return "4,000원";
      });
      const [lastE] = await as(
        tx,
        E,
        (sp) =>
          sp<
            SummaryRow[]
          >`select * from public.settlement_summary(null, ${months.last}::date, ${months.last}::date)`,
      );
      const lastItems = await as(
        tx,
        E,
        (sp) => sp<{ item_id: string; refund: number; revenue: number }[]>`
          select item_id, refund, revenue from public.settlement_items(null, ${months.last}::date, ${months.last}::date)`,
      );
      check(
        "조정 전표: 정산 완료 달 숫자·항목은 조정 전 그대로 (지급 29,750 · 환불 0)",
        // (위 정산 검증이 취소 항목 환불을 직접 0으로 바꿔 두어 실시간 합계는 스냅숏과 다르다 → 조정 항목만 본다)
        lastE?.payout === 29750 &&
          lastE.settled_at !== null &&
          lastItems.find((i) => i.item_id === usedE.id)?.refund === 0,
        `지급 ${lastE?.payout} · 항목 환불 ${lastItems.find((i) => i.item_id === usedE.id)?.refund}`,
      );
      const [currentE] = await as(
        tx,
        E,
        (sp) =>
          sp<
            SummaryRow[]
          >`select * from public.settlement_summary(null, ${months.current}::date, ${months.current}::date)`,
      );
      const adjustmentRows = await as(
        tx,
        E,
        (sp) => sp<{ status: string; refund: number; revenue: number; commission: number }[]>`
          select status, refund, revenue, commission
          from public.settlement_items(null, ${months.current}::date, ${months.current}::date)`,
      );
      check(
        "조정 전표: 이번 달에 매출 −4,000 · 수수료 −600 · 지급 −3,400 (건수 0)",
        currentE?.revenue === -4000 &&
          currentE.commission === -600 &&
          currentE.payout === -3400 &&
          currentE.item_count === 0 &&
          adjustmentRows.length === 1 &&
          adjustmentRows[0]?.status === "adjustment" &&
          adjustmentRows[0].refund === 4000,
        `매출 ${currentE?.revenue} · 수수료 ${currentE?.commission} · 지급 ${currentE?.payout} · ${currentE?.item_count}건`,
      );
      await expectOk(tx, "파트너 E: 자기 조정 전표 읽기", E, async (sp) => {
        const rows =
          await sp`select 1 from public.settlement_adjustments where partner_id = ${partnerE.id}`;
        if (rows.length !== 1) throw new Error(`${rows.length}행`);
        return "1행";
      });
      await expectBlocked(
        tx,
        "다른 파트너 D: E의 조정 전표 읽기",
        D,
        async (sp) =>
          (await sp`select 1 from public.settlement_adjustments where partner_id = ${partnerE.id}`)
            .length,
      );
      await expectBlocked(
        tx,
        "관리자: 조정 전표 직접 쓰기",
        admin,
        async (sp) =>
          (
            await sp`insert into public.settlement_adjustments (partner_id, month, order_item_id, revenue_delta, commission_delta, source)
                     values (${partnerE.id}, ${months.current}::date, ${usedE.id}, -1, 0, 'x')`
          ).count,
      );
      await expectBlocked(
        tx,
        "관리자: 환불 조정 기록 직접 쓰기",
        admin,
        async (sp) =>
          (
            await sp`insert into public.refund_adjustments (order_item_id, before_amount, after_amount, reason)
                     values (${usedE.id}, 0, 1, 'x')`
          ).count,
      );

      // CS 메모: 관리자만 남기고 읽는다, 고칠 수 없다
      await expectOk(tx, "관리자: CS 메모 남기기", admin, async (sp) => {
        const r =
          await sp`insert into public.order_memos (order_id, body) values (${opsOrder.id}, '고객 전화 — 픽업 변경')`;
        return `${r.count}행`;
      });
      await expectBlocked(
        tx,
        "고객: 본인 주문에 CS 메모 남기기",
        A,
        async (sp) =>
          (
            await sp`insert into public.order_memos (order_id, body) values (${opsOrder.id}, '메모')`
          ).count,
      );
      await expectBlocked(
        tx,
        "고객: 본인 주문 CS 메모 읽기",
        A,
        async (sp) =>
          (await sp`select 1 from public.order_memos where order_id = ${opsOrder.id}`).length,
      );
      await expectBlocked(
        tx,
        "관리자: CS 메모 고치기",
        admin,
        async (sp) =>
          (await sp`update public.order_memos set body = 'x' where order_id = ${opsOrder.id}`)
            .count,
      );
      await expectBlocked(
        tx,
        "관리자: 다른 사람 이름으로 CS 메모",
        admin,
        async (sp) =>
          (
            await sp`insert into public.order_memos (order_id, body, created_by) values (${opsOrder.id}, '메모', ${userA})`
          ).count,
      );

      // ── 관리자 주문 목록 (관리자 개선 S3): admin_orders 상태·파트너 필터
      // 위 운영 주문: 취소 3(기상·고객 요청·당일 기상) + 이용 완료 1(지난 날 확정) + 이용 예정 1(20일 뒤) → 이용 예정 · 부분 취소
      const [opsNo] = await tx<{ order_no: string }[]>`
        select order_no from public.orders where id = ${opsOrder.id}`;
      const [settleNo] = await tx<{ order_no: string }[]>`
        select order_no from public.orders where id = ${settleOrder.id}`;
      if (!opsNo || !settleNo) throw new Error("주문번호 없음");
      const adminOrders = (sp: Tx, q: string, status: string, partner: string | null = null) =>
        sp<
          {
            order_no: string;
            display_status: string;
            partial: boolean;
            upcoming_count: number;
            used_count: number;
            closed_count: number;
            total_count: number;
          }[]
        >`select * from public.admin_orders(${q}, ${status}, ${partner}, null, null, 30, 0)`;
      await expectError(tx, "고객: 관리자 주문 목록", A, "forbidden", (sp) =>
        adminOrders(sp, "", "all"),
      );
      await expectError(tx, "파트너: 관리자 주문 목록", D, "forbidden", (sp) =>
        adminOrders(sp, "", "all"),
      );
      await expectOk(tx, "관리자: 부분 취소 필터 → 상태 · 항목 수", admin, async (sp) => {
        const [r] = await adminOrders(sp, opsNo.order_no.toLowerCase(), "partial");
        if (
          !r ||
          r.display_status !== "upcoming" ||
          !r.partial ||
          r.closed_count !== 3 ||
          r.used_count !== 1 ||
          r.upcoming_count !== 1 ||
          r.total_count !== 1
        )
          throw new Error(JSON.stringify(r));
        return `${r.display_status} · 취소 ${r.closed_count} · 이용 완료 ${r.used_count} · 이용 예정 ${r.upcoming_count}`;
      });
      await expectBlocked(
        tx,
        "관리자: 취소 필터에는 부분 취소 주문 없음",
        admin,
        async (sp) => (await adminOrders(sp, opsNo.order_no, "cancelled")).length,
      );
      await expectOk(tx, "관리자: 파트너 필터 (E의 정산 주문)", admin, async (sp) => {
        const mine = await adminOrders(sp, settleNo.order_no, "all", partnerE.id);
        const other = await adminOrders(sp, settleNo.order_no, "all", snorkel.partner_id);
        if (mine.length !== 1 || other.length !== 0)
          throw new Error(`E ${mine.length}건 · 다른 파트너 ${other.length}건`);
        return "E 1건 · 다른 파트너 0건";
      });
      await expectError(tx, "관리자: 모르는 상태 필터", admin, "invalid_status", (sp) =>
        adminOrders(sp, "", "whatever"),
      );
      await expectError(
        tx,
        "관리자: 한 번에 5,000건 넘게",
        admin,
        "invalid_range",
        (sp) => sp`select * from public.admin_orders('', 'all', null, null, null, 5001, 0)`,
      );

      // ── 판매 중지 종류 · 파트너 정지 일괄 처리 · 사유 (관리자 개선 S4)
      const [hideLog] = await tx<{ reason: string | null }[]>`
        select reason from public.audit_logs where entity_id = ${reviewA.id} and action = 'review.hide'`;
      check(
        "감사 로그: 리뷰 숨김 사유",
        hideLog?.reason === "광고성 리뷰 확인",
        hideLog?.reason ?? "없음",
      );
      await expectError(
        tx,
        "관리자: 사유 없이 리뷰 숨김 해제",
        admin,
        "invalid_note",
        (sp) => sp`select public.admin_set_review_hidden(${reviewA.id}, false, '')`,
      );
      await expectError(
        tx,
        "관리자: 종류 없이 판매 중지",
        admin,
        "invalid_suspend_kind",
        (sp) => sp`select public.admin_set_product_suspension(${tea.id}, true, null, '점검')`,
      );
      await expectError(
        tx,
        "관리자: 사유 없이 판매 재개",
        admin,
        "invalid_suspend_reason",
        (sp) => sp`select public.admin_set_product_suspension(${fuji.id}, false, null, '')`,
      );

      // 운영 불가 중지: 다도 체험의 이용 전 예약(확정 대기 · 확정)은 전액 환불 취소, 지난 예약은 그대로
      const [unsafeOrder] = await tx<{ id: string }[]>`
        insert into public.orders (order_no, user_id, booker_name, booker_email, booker_phone, total_amount, idempotency_key, policy_agreed_at)
        values (${`TEST-${randomUUID()}`}, ${userA}, '검증A', 'a@rls.test', '010-1234-5678', 90000, ${randomUUID()}, now())
        returning id`;
      if (!unsafeOrder) throw new Error("운영 불가 주문 생성 실패");
      const unsafeDate = await dayPlus(12);
      const teaItem = async (useDate: string, status: string) => {
        const [row] = await tx<{ id: string }[]>`
          insert into public.order_items (order_id, product_id, product_title, use_date, adult_qty, child_qty,
            adult_price, subtotal, cancel_policy, slot_id, partner_id, commission_rate, status)
          select ${unsafeOrder.id}, p.id, '다도 검증', ${useDate}::date, 1, 0, 30000, 30000, 'standard',
            ${teaSlot.id}, p.partner_id, 15, ${status}::public.order_item_status
          from public.products p where p.id = ${tea.id}
          returning id`;
        if (status !== "used") {
          await tx`insert into public.slot_inventory (slot_id, use_date, booked) values (${teaSlot.id}, ${useDate}::date, 1)
                   on conflict (slot_id, use_date) do update set booked = public.slot_inventory.booked + 1`;
        }
        if (!row) throw new Error("다도 항목 생성 실패");
        return row.id;
      };
      const teaPending = await teaItem(unsafeDate, "pending");
      const teaConfirmed = await teaItem(unsafeDate, "confirmed");
      const teaUsed = await teaItem(dates.past, "used");
      await expectError(
        tx,
        "고객: 판매 중지 영향 미리보기",
        A,
        "forbidden",
        (sp) => sp`select * from public.admin_product_impact(${tea.id})`,
      );
      const [teaImpact] = await as(
        tx,
        admin,
        (sp) =>
          sp<
            { pending_count: number; confirmed_count: number; refund_total: number }[]
          >`select * from public.admin_product_impact(${tea.id})`,
      );
      const teaLive = (teaImpact?.pending_count ?? 0) + (teaImpact?.confirmed_count ?? 0);
      check(
        "영향 미리보기: 이용 전 예약 수 · 전액 환불 금액",
        teaLive >= 2 && (teaImpact?.refund_total ?? 0) >= 60000,
        `${teaLive}건 · ${teaImpact?.refund_total?.toLocaleString()}원`,
      );
      const bookedBeforeUnsafe = await bookedOf(teaSlot.id, unsafeDate);
      await expectOk(tx, "관리자: 운영 불가로 판매 중지 → 이용 전 예약 취소", admin, async (sp) => {
        const [r] = await sp<{ n: number }[]>`
          select public.admin_set_product_suspension(${tea.id}, true, 'unsafe', '시설 안전 점검 불합격') as n`;
        if (r?.n !== teaLive) throw new Error(`${r?.n}건 (예상 ${teaLive})`);
        return `${r.n}건 취소`;
      });
      const teaRows = await tx<
        { id: string; status: string; refund_amount: number | null; cancel_reason: string | null }[]
      >`select id, status::text, refund_amount, cancel_reason from public.order_items
        where id in (${teaPending}, ${teaConfirmed}, ${teaUsed})`;
      const byId = new Map(teaRows.map((r) => [r.id, r]));
      check(
        "운영 불가 중지: 확정 대기·확정 → 전액 환불 취소 · 사유, 지난 예약은 그대로 · 좌석 반환",
        [teaPending, teaConfirmed].every(
          (id) =>
            byId.get(id)?.status === "cancelled" &&
            byId.get(id)?.refund_amount === 30000 &&
            byId.get(id)?.cancel_reason === "판매 중지(운영 불가) — 시설 안전 점검 불합격",
        ) &&
          byId.get(teaUsed)?.status === "used" &&
          (await bookedOf(teaSlot.id, unsafeDate)) === bookedBeforeUnsafe - 2,
        teaRows.map((r) => `${r.status}/${r.refund_amount ?? "-"}`).join(", "),
      );
      const [unsafeLog] = await tx<{ actor_role: string; reason_code: string | null }[]>`
        select actor_role, reason_code from public.audit_logs
        where entity_id = ${teaConfirmed} and action = 'item.cancelled'`;
      check(
        "감사 로그: 운영 불가 취소 → 관리자 · product_unsafe",
        unsafeLog?.actor_role === "admin" && unsafeLog.reason_code === "product_unsafe",
        `${unsafeLog?.actor_role} · ${unsafeLog?.reason_code}`,
      );
      await expectBlocked(
        tx,
        "운영 불가 중지 → 공개 목록 조건(판매 중지 아님)에서 제외",
        anon,
        async (sp) =>
          (
            await sp`select 1 from public.products where id = ${tea.id} and published_at is not null and suspended_reason is null`
          ).length,
      );
      await expectOk(tx, "관리자: 사유와 함께 판매 재개", admin, async (sp) => {
        await sp`select public.admin_set_product_suspension(${tea.id}, false, null, '재점검 통과')`;
        const [p] = await sp<{ k: string | null }[]>`
          select suspended_kind::text as k from public.products where id = ${tea.id}`;
        if (p?.k !== null) throw new Error(`종류 ${p?.k}`);
        return "재개 · 종류 비움";
      });

      // 파트너 정지 해제: 정지로 함께 중지된 상품만 다시 열고, 관리자가 따로 중지한 상품은 그대로
      await tx`update public.partners set status = 'active' where id = ${snorkel.partner_id}`;
      await as(
        tx,
        admin,
        (sp) =>
          sp`select public.admin_set_product_suspension(${snorkel.id}, true, 'info_fix', '사진 교체 필요')`,
      );
      const [{ n: openBefore } = { n: -1 }] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.products
        where partner_id = ${snorkel.partner_id} and suspended_reason is null`;
      await expectOk(tx, "관리자: 파트너 정지 → 판매 중 상품만 함께 중지", admin, async (sp) => {
        const [r] = await sp<{ n: number }[]>`
          select public.admin_set_partner_status(${snorkel.partner_id}, 'suspended', '정산 서류 미제출') as n`;
        if (r?.n !== openBefore) throw new Error(`${r?.n}개 (예상 ${openBefore})`);
        return `${r.n}개`;
      });
      await expectOk(tx, "관리자: 정지 해제 → 정지로 중지된 상품만 재개", admin, async (sp) => {
        const [r] = await sp<{ n: number }[]>`
          select public.admin_set_partner_status(${snorkel.partner_id}, 'active', '서류 제출 확인') as n`;
        const [still] = await sp<{ k: string | null }[]>`
          select suspended_kind::text as k from public.products where id = ${snorkel.id}`;
        if (r?.n !== openBefore || still?.k !== "info_fix")
          throw new Error(`재개 ${r?.n}개 · 스노클링 ${still?.k}`);
        return `${r.n}개 재개 · 따로 중지한 상품은 그대로`;
      });
      await expectError(
        tx,
        "파트너: 파트너 영향 미리보기",
        D,
        "forbidden",
        (sp) => sp`select * from public.admin_partner_impact(${snorkel.partner_id})`,
      );

      // ── 취소 규정 스냅숏 (P0 A-03): 결제 뒤 규정을 바꿔도 이미 산 예약은 동의한 구간대로 환불
      const [tierOrder] = await tx<{ id: string }[]>`
        insert into public.orders (order_no, user_id, booker_name, booker_email, booker_phone, total_amount, idempotency_key, policy_agreed_at)
        values (${`TEST-${randomUUID()}`}, ${userA}, '검증A', 'a@rls.test', '010-1234-5678', 60000, ${randomUUID()}, now())
        returning id`;
      if (!tierOrder) throw new Error("규정 스냅숏 주문 생성 실패");
      const tierDate = await dayPlus(4);
      const tierItem = async () => {
        const [row] = await tx<{ id: string; tiers: { days_before: number }[] }[]>`
          insert into public.order_items (order_id, product_id, product_title, use_date, adult_qty, child_qty,
            adult_price, subtotal, cancel_policy, slot_id, partner_id, commission_rate, status)
          select ${tierOrder.id}, p.id, '규정 검증', ${tierDate}::date, 1, 0, 30000, 30000, 'standard',
            ${fujiSlot.id}, p.partner_id, 15, 'confirmed'
          from public.products p where p.id = ${fuji.id}
          returning id, cancel_tiers as tiers`;
        await tx`insert into public.slot_inventory (slot_id, use_date, booked) values (${fujiSlot.id}, ${tierDate}::date, 1)
                 on conflict (slot_id, use_date) do update set booked = public.slot_inventory.booked + 1`;
        if (!row) throw new Error("규정 스냅숏 항목 생성 실패");
        return row;
      };
      const oldTierItem = await tierItem();
      check(
        "규정 스냅숏: 주문 항목에 그때 구간 복사 (일반 취소 7·3·1일)",
        oldTierItem.tiers.map((t) => t.days_before).join(",") === "7,3,1",
        JSON.stringify(oldTierItem.tiers),
      );
      // 규정을 바꾼다 (검증용으로 직접): 일반 취소의 모든 구간을 환불 0%로
      await tx`update public.cancellation_policy_tiers set refund_rate = 0 where policy_code = 'standard'`;
      const newTierItem = await tierItem();
      const quoteOf = async (itemId: string) => {
        const [q] = await as(
          tx,
          A,
          (sp) => sp<{ refund_amount: number }[]>`
            select refund_amount from public.refund_quote(${tierOrder.id}) where order_item_id = ${itemId}`,
        );
        return q?.refund_amount;
      };
      check(
        "규정 변경 후: 전에 산 예약은 동의한 구간(4일 전 50%), 새 예약은 바뀐 구간(0%)",
        (await quoteOf(oldTierItem.id)) === 15000 && (await quoteOf(newTierItem.id)) === 0,
        `전 ${await quoteOf(oldTierItem.id)} · 후 ${await quoteOf(newTierItem.id)}`,
      );
      await expectOk(tx, "고객: 규정 변경 전에 산 예약 취소 → 50% 환불", A, async (sp) => {
        const [r] = await sp<{ refund: number }[]>`
          select public.cancel_order_item(${oldTierItem.id}) as refund`;
        if (r?.refund !== 15000) throw new Error(`환불 ${r?.refund}`);
        return `환불 ${r.refund.toLocaleString()}원`;
      });

      // ── 회원 삭제 시 주문 보존 (P0 A-05): 계정을 지워도 주문·항목·정산 근거·감사 로그는 남는다
      const userF = randomUUID();
      await tx`insert into auth.users (id, email, raw_user_meta_data, aud, role)
               values (${userF}, ${`${userF}@rls.test`}, ${sql.json({ name: "탈퇴 예정" })}, 'authenticated', 'authenticated')`;
      // 정산 완료된 지난달(E)에 이용 완료한 주문
      const [leaveOrder] = await tx<{ id: string }[]>`
        insert into public.orders (order_no, user_id, booker_name, booker_email, booker_phone, total_amount, idempotency_key, policy_agreed_at)
        values (${`TEST-${randomUUID()}`}, ${userF}, '탈퇴', 'f@rls.test', '010-1234-5678', 20000, ${randomUUID()}, now())
        returning id`;
      if (!leaveOrder) throw new Error("탈퇴 검증 주문 생성 실패");
      const [leaveItem] = await tx<{ id: string }[]>`
        insert into public.order_items (order_id, product_id, product_title, use_date, adult_qty, child_qty,
          adult_price, subtotal, cancel_policy, slot_id, partner_id, commission_rate, status)
        values (${leaveOrder.id}, ${fuji.id}, '탈퇴 검증', ${months.last}::date + 10, 1, 0,
          20000, 20000, 'standard', ${fujiSlot.id}, ${partnerE.id}, 15, 'used')
        returning id`;
      if (!leaveItem) throw new Error("탈퇴 검증 항목 생성 실패");
      await tx`delete from auth.users where id = ${userF}`;
      const [kept] = await tx<
        { user_id: string | null; items: number; profile: number; logs: number }[]
      >`
        select o.user_id,
               (select count(*)::int from public.order_items oi where oi.order_id = o.id) as items,
               (select count(*)::int from public.profiles p where p.id = ${userF}) as profile,
               (select count(*)::int from public.audit_logs a where a.order_id = o.id) as logs
        from public.orders o where o.id = ${leaveOrder.id}`;
      check(
        "회원 삭제: 프로필은 지워지고 주문·항목·감사 로그는 남음 (주문 소유자 null)",
        kept?.user_id === null && kept.items === 1 && kept.profile === 0 && kept.logs >= 2,
        `소유자 ${kept?.user_id ?? "null"} · 항목 ${kept?.items} · 프로필 ${kept?.profile} · 기록 ${kept?.logs}`,
      );
      await expectOk(tx, "회원 삭제 뒤: 파트너 E 정산 항목에 그 예약이 남음", E, async (sp) => {
        const rows = await sp`
          select 1 from public.settlement_items(null, ${months.last}::date, ${months.last}::date)
          where item_id = ${leaveItem.id}`;
        if (rows.length !== 1) throw new Error(`${rows.length}행`);
        return "1행";
      });
      await expectOk(tx, "회원 삭제 뒤: 관리자는 주문을 볼 수 있음", admin, async (sp) => {
        const rows = await sp`select 1 from public.orders where id = ${leaveOrder.id}`;
        if (rows.length !== 1) throw new Error(`${rows.length}행`);
        return "1행";
      });
      await expectBlocked(
        tx,
        "회원 삭제 뒤: 다른 고객은 소유자 없는 주문을 볼 수 없음",
        A,
        async (sp) => (await sp`select 1 from public.orders where id = ${leaveOrder.id}`).length,
      );

      // ── 파트너 연락처 가리기 (P0 A-06): 원문은 살아 있는 예약 + 이용일 7일 뒤까지만
      const [maskOrder] = await tx<{ id: string }[]>`
        insert into public.orders (order_no, user_id, booker_name, booker_email, booker_phone, total_amount, idempotency_key, policy_agreed_at)
        values (${`TEST-${randomUUID()}`}, ${userA}, '김여운', 'yeoun@rls.test', '010-1234-5678', 40000, ${randomUUID()}, now())
        returning id`;
      if (!maskOrder) throw new Error("가리기 검증 주문 생성 실패");
      // 회차는 위 재고 검증에서 찾은 스노클링 회차(snorkelSlot)를 쓴다
      const maskItem = async (offset: number, status: string) => {
        const [row] = await tx<{ id: string }[]>`
          insert into public.order_items (order_id, product_id, product_title, use_date, adult_qty, child_qty,
            adult_price, subtotal, cancel_policy, slot_id, partner_id, commission_rate, status)
          values (${maskOrder.id}, ${snorkel.id}, '가리기 검증', public.seoul_today() + ${offset}::int, 1, 0,
            10000, 10000, 'standard', ${snorkelSlot.id}, ${snorkel.partner_id}, 15, ${status}::public.order_item_status)
          returning id`;
        if (!row) throw new Error("가리기 검증 항목 생성 실패");
        return row.id;
      };
      const maskCases = {
        upcoming: await maskItem(5, "confirmed"), // 원문
        recentUsed: await maskItem(-3, "used"), // 이용 3일 뒤 → 원문
        oldUsed: await maskItem(-10, "used"), // 이용 10일 뒤 → 가림
        cancelled: await maskItem(6, "cancelled"), // 취소 → 바로 가림
      };
      const [maskFrom] = await tx<{ from: string; to: string; tooEarly: string }[]>`
        select (public.seoul_today() - 90)::text as from, (public.seoul_today() + 30)::text as to,
               (public.seoul_today() - 91)::text as "tooEarly"`;
      if (!maskFrom) throw new Error("날짜 계산 실패");
      const maskRows = await as(
        tx,
        D,
        (sp) => sp<
          {
            item_id: string;
            booker_name: string;
            booker_phone: string;
            booker_email: string;
            contact_masked: boolean;
          }[]
        >`select item_id, booker_name, booker_phone, booker_email, contact_masked
          from public.partner_bookings(${maskFrom.from}::date, ${maskFrom.to}::date)`,
      );
      const maskBy = new Map(maskRows.map((r) => [r.item_id, r]));
      const raw = (id: string) =>
        maskBy.get(id)?.booker_name === "김여운" &&
        maskBy.get(id)?.booker_phone === "010-1234-5678" &&
        maskBy.get(id)?.contact_masked === false;
      const masked = (id: string) =>
        maskBy.get(id)?.booker_name === "김*운" &&
        maskBy.get(id)?.booker_phone === "010-****-5678" &&
        maskBy.get(id)?.booker_email === "y***@rls.test" &&
        maskBy.get(id)?.contact_masked === true;
      check(
        "연락처: 이용 예정 · 이용 3일 뒤는 원문",
        raw(maskCases.upcoming) && raw(maskCases.recentUsed),
        `${maskBy.get(maskCases.upcoming)?.booker_phone} · ${maskBy.get(maskCases.recentUsed)?.booker_phone}`,
      );
      check(
        "연락처: 이용 10일 뒤 · 취소 예약은 가림 (김*운 · 010-****-5678 · y***@)",
        masked(maskCases.oldUsed) && masked(maskCases.cancelled),
        `${maskBy.get(maskCases.oldUsed)?.booker_name} · ${maskBy.get(maskCases.cancelled)?.booker_email}`,
      );
      await expectError(
        tx,
        "파트너: 90일보다 이전 이용분 조회",
        D,
        "invalid_range",
        (sp) =>
          sp`select * from public.partner_bookings(${maskFrom.tooEarly}::date, ${maskFrom.to}::date)`,
      );
      await expectBlocked(
        tx,
        "가리기 헬퍼 직접 호출",
        D,
        async (sp) => (await sp`select public.mask_phone('010-1234-5678')`).count,
      );

      // 검증이 끝나면 모든 변경을 되돌린다
      throw new RollbackSignal();
    })
    .catch((error: unknown) => {
      if (!(error instanceof RollbackSignal)) throw error;
    });

  for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name} — ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed === 0 ? `\n전체 ${results.length}개 통과` : `\n${failed}개 실패`);
  if (failed > 0) process.exitCode = 1;
}

class RollbackSignal extends Error {}

main()
  .catch((error: unknown) => {
    console.error("✗ 검증 실행 실패:", error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
