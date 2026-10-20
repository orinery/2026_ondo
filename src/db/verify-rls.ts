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
        await tx`insert into public.order_items (order_id, product_id, product_title, use_date, adult_qty, child_qty, adult_price, subtotal, cancel_policy)
                 values (${o.id}, ${fuji.id}, '경계 테스트', public.seoul_today() + ${days}::int, 1, 0, 10000, 10000, 'standard')`;
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
      await tx`insert into public.order_items (order_id, product_id, product_title, use_date, adult_qty, child_qty, adult_price, subtotal, cancel_policy)
               values (${todayOrder.id}, ${fuji.id}, '당일', public.seoul_today(), 1, 0, 10000, 10000, 'standard')`;
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
      await tx`insert into public.order_items (order_id, product_id, product_title, use_date, adult_qty, child_qty, adult_price, subtotal, cancel_policy)
               values (${pastOrder.id}, ${tea.id}, '다도', ${dates.past}, 1, 0, 38000, 38000, 'standard')`;

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
