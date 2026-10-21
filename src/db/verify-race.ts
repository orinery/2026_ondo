/**
 * 초과 판매 방지 검증 (동시 결제) — `npm run db:verify-race`
 *
 * verify-rls는 한 트랜잭션 안에서 차례로 실행하므로 "동시에" 들어오는 결제를 재현할 수 없다.
 * 여기서는 정원 5명인 회차에 10명이 서로 다른 연결로 동시에 1석씩 결제한다.
 * 기대: 정확히 5건만 성공하고 5건은 sold_out, 예약 인원(booked) = 5.
 *
 * 동시성을 보려면 커밋된 데이터가 필요해서 검증용 데이터(사용자·파트너·상품)를 실제로 만들고,
 * 끝나면(실패해도) 모두 지운다. 다른 데이터는 건드리지 않는다.
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

const BUYERS = 10;
const CAPACITY = 5;

// 결제마다 다른 연결을 쓰도록 연결을 넉넉히 연다 (한 연결이면 차례로 실행돼 동시성이 없다)
const sql = postgres(databaseUrl, { prepare: false, max: BUYERS + 1, onnotice: () => {} });

async function main() {
  const tag = randomUUID().slice(0, 8);
  const users = Array.from({ length: BUYERS }, () => randomUUID());
  const partnerId = randomUUID();
  let productId: string | null = null;

  try {
    // ── 검증용 데이터 (관리자 권한으로 만든다)
    for (const id of users) {
      await sql`insert into auth.users (id, email, raw_user_meta_data, aud, role)
                values (${id}, ${`${id}@race.test`}, ${sql.json({ name: "동시결제" })}, 'authenticated', 'authenticated')`;
    }
    await sql`insert into public.partners (id, name, contact_name, contact_phone, contact_email, intro)
              values (${partnerId}, ${`race-${tag}`}, '검증', '02-000-0000', 'race@race.test', '동시 결제 검증용 파트너')`;
    const [city] = await sql<
      { id: string }[]
    >`select id from public.cities order by position limit 1`;
    if (!city) throw new Error("도시가 없습니다. 먼저 npm run db:seed를 실행하세요.");
    const [product] = await sql<{ id: string; adult_price: number }[]>`
      insert into public.products (slug, partner_id, city_id, category, theme, title, summary, description,
        image_url, image_alt, adult_price, operating_days, cutoff_days, max_qty, duration_text,
        meeting_point, latitude, longitude, cancel_policy, published_at)
      values (${`race-${tag}`}, ${partnerId}, ${city.id}, 'tour', 'city', '동시 결제 검증 상품', '검증',
        '검증용 상품', 'https://images.unsplash.com/photo-1', '검증', 10000, '{1,2,3,4,5,6,7}', 0, 10,
        '1시간', '검증 장소', 35, 135, 'standard', now())
      returning id, adult_price`;
    if (!product) throw new Error("상품 생성 실패");
    productId = product.id;
    const [slot] = await sql<{ id: string }[]>`
      insert into public.product_slots (product_id, start_time, capacity)
      values (${product.id}, '10:00', ${CAPACITY}) returning id`;
    if (!slot) throw new Error("회차 생성 실패");
    const [day] = await sql<{ d: string }[]>`select (public.seoul_today() + 20)::text as d`;
    if (!day) throw new Error("날짜 계산 실패");

    // 각 사용자 장바구니에 1석 (아직 아무도 결제하지 않아 담기는 모두 성공)
    const carts: { userId: string; cartId: string }[] = [];
    for (const userId of users) {
      const [cart] = await sql<{ id: string }[]>`
        insert into public.cart_items (user_id, product_id, slot_id, use_date, adult_qty)
        values (${userId}, ${product.id}, ${slot.id}, ${day.d}, 1) returning id`;
      if (!cart) throw new Error("장바구니 담기 실패");
      carts.push({ userId, cartId: cart.id });
    }

    // ── 10명이 동시에 결제: 연결마다 그 사용자로 로그인한 것과 같은 조건을 만든 뒤 place_order
    const started = Date.now();
    const results = await Promise.allSettled(
      carts.map(({ userId, cartId }) =>
        sql.begin(async (tx) => {
          await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: "authenticated", sub: userId })}, true)`;
          await tx.unsafe("set local role authenticated");
          const [row] = await tx<{ order_no: string }[]>`
            select public.place_order(${[cartId]}::uuid[], '동시결제', 'race@race.test', '010-1234-5678',
              true, ${product.adult_price}, ${randomUUID()}::uuid) as order_no`;
          return row?.order_no ?? "";
        }),
      ),
    );
    const elapsed = Date.now() - started;

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const soldOut = results.filter(
      (r) => r.status === "rejected" && String((r.reason as Error).message).includes("sold_out"),
    ).length;
    const other = results
      .filter(
        (r) => r.status === "rejected" && !String((r.reason as Error).message).includes("sold_out"),
      )
      .map((r) => (r.status === "rejected" ? String((r.reason as Error).message) : ""));
    const [inv] = await sql<{ booked: number }[]>`
      select booked from public.slot_inventory where slot_id = ${slot.id} and use_date = ${day.d}`;
    const [items] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.order_items where slot_id = ${slot.id} and use_date = ${day.d}`;

    const checks = [
      [`결제 성공 = 정원 ${CAPACITY}건`, ok === CAPACITY, `${ok}건`],
      [
        `나머지 ${BUYERS - CAPACITY}건은 매진(sold_out)`,
        soldOut === BUYERS - CAPACITY,
        `${soldOut}건`,
      ],
      ["다른 오류 없음 (교착 등)", other.length === 0, other.join(" / ") || "없음"],
      [`예약 인원 카운터 = ${CAPACITY}`, inv?.booked === CAPACITY, `booked=${inv?.booked}`],
      ["생성된 주문 항목 = 결제 성공 수", items?.n === ok, `${items?.n}개`],
    ] as const;
    for (const [name, pass, detail] of checks)
      console.log(`${pass ? "✓" : "✗"} ${name} — ${detail}`);
    console.log(`(동시 결제 ${BUYERS}건 ${elapsed}ms)`);
    const failed = checks.filter(([, pass]) => !pass).length;
    console.log(failed === 0 ? `\n전체 ${checks.length}개 통과` : `\n${failed}개 실패`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    // ── 정리: 주문(→ 항목·옵션 연쇄) · 여행 · 장바구니 · 사용자 · 상품(→ 회차·재고 연쇄) · 파트너
    await sql`delete from public.orders where user_id = any(${users}::uuid[])`;
    await sql`delete from public.trips where user_id = any(${users}::uuid[])`;
    await sql`delete from auth.users where id = any(${users}::uuid[])`;
    if (productId) await sql`delete from public.products where id = ${productId}`;
    await sql`delete from public.partners where id = ${partnerId}`;
    console.log("검증 데이터 정리 완료");
  }
}

main()
  .catch((error: unknown) => {
    console.error("✗ 동시 결제 검증 실패:", error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
