/**
 * 시드 스크립트 — `npm run db:seed`
 *
 * 여러 번 실행해도 결과가 같다(멱등):
 * - 취소 규정·도시·상품은 코드/slug 기준 upsert, 규정 구간·사진·진행 일정은 지우고 다시 넣는다.
 * - 데모 사용자는 이메일로 찾아서 없을 때만 만든다.
 * - 데모 주문은 (사용자, 중복 방지 키) 기준으로 한 번만 만든다. 키는 이메일+상품으로 고정 계산한다.
 * - 리뷰는 (작성자, 상품) 기준 upsert. "구매 고객만 리뷰" 규칙에 맞게 리뷰마다 이용 완료 주문을 먼저 만든다.
 *
 * 선택: SEED_BUYER_EMAIL=본인 이메일 을 주면 그 계정에 "이용 완료" 주문 1건을 넣어
 *       리뷰 작성 흐름을 직접 확인할 수 있다 (이미 가입한 계정이어야 한다).
 *
 * DATABASE_URL(postgres 권한)로 접속하므로 RLS를 우회한다. 시드처럼 관리 작업에만 쓴다.
 */
import { createHash, randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { and, eq, sql } from "drizzle-orm";
import { pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";
import {
  SEED_CITIES,
  SEED_POLICIES,
  SEED_PRODUCTS,
  SEED_REVIEWERS,
  type SeedProduct,
} from "./seed-data";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경 변수가 이미 주입된 환경(CI 등)이면 파일이 없어도 된다
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL이 없습니다. .env.example을 참고해 .env.local을 만들어 주세요.");
}

// prepare: false — Supabase 커넥션 풀러(트랜잭션 모드)는 prepared statement를 지원하지 않는다
const client = postgres(databaseUrl, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

// auth.users의 이메일만 읽기 위한 최소 정의 (drizzle-orm/supabase의 authUsers는 id만 있다)
const authUsersEmail = pgSchema("auth").table("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const photoUrl = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;

/** 같은 입력이면 항상 같은 UUID (시드 주문의 중복 방지 키 → 다시 실행해도 주문이 늘지 않는다) */
function stableUuid(input: string) {
  const h = createHash("sha1").update(input).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** "YYYY-MM-DD"에 일수를 더한다 (UTC 기준 계산 — 날짜 문자열만 다루므로 시간대 영향 없음) */
function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seedCatalog() {
  await db.transaction(async (tx) => {
    for (const p of SEED_POLICIES) {
      await tx
        .insert(schema.cancellationPolicies)
        .values({ code: p.code, name: p.name, summary: p.summary })
        .onConflictDoUpdate({
          target: schema.cancellationPolicies.code,
          set: { name: p.name, summary: p.summary },
        });
      await tx
        .delete(schema.cancellationPolicyTiers)
        .where(eq(schema.cancellationPolicyTiers.policyCode, p.code));
      await tx.insert(schema.cancellationPolicyTiers).values(
        p.tiers.map(([daysBefore, refundRate]) => ({
          policyCode: p.code,
          daysBefore,
          refundRate,
        })),
      );
    }

    const cityIds = new Map<string, string>();
    for (const [position, c] of SEED_CITIES.entries()) {
      const values = {
        slug: c.slug,
        name: c.name,
        nameEn: c.nameEn,
        summary: c.summary,
        imageUrl: photoUrl(c.image[0]),
        imageAlt: c.image[1],
        latitude: c.latitude,
        longitude: c.longitude,
        position,
      };
      const [row] = await tx
        .insert(schema.cities)
        .values(values)
        .onConflictDoUpdate({ target: schema.cities.slug, set: values })
        .returning({ id: schema.cities.id });
      if (!row) throw new Error(`${c.slug}: 도시 upsert 실패`);
      cityIds.set(c.slug, row.id);
    }

    for (const p of SEED_PRODUCTS) {
      const cityId = cityIds.get(p.city);
      if (!cityId) throw new Error(`${p.slug}: 도시 ${p.city}가 없습니다`);
      await upsertProduct(tx, p, cityId);
    }
  });
  console.log(
    `✓ 취소 규정 ${SEED_POLICIES.length}종 · 도시 ${SEED_CITIES.length}곳 · 상품 ${SEED_PRODUCTS.length}개`,
  );
}

async function upsertProduct(tx: Tx, p: SeedProduct, cityId: string) {
  const [cover] = p.images;
  if (!cover) throw new Error(`${p.slug}: 대표 사진이 없습니다`);

  const values = {
    slug: p.slug,
    cityId,
    category: p.category,
    theme: p.theme,
    title: p.title,
    summary: p.summary,
    description: p.description,
    highlights: p.highlights,
    imageUrl: photoUrl(cover[0]),
    imageAlt: cover[1],
    adultPrice: p.adultPrice,
    childPrice: p.childPrice,
    listAdultPrice: p.listAdultPrice ?? null,
    operatingDays: p.operatingDays,
    cutoffDays: p.cutoffDays,
    maxQty: p.maxQty,
    startTime: p.startTime,
    durationText: p.durationText,
    includes: p.includes,
    excludes: p.excludes,
    usageInfo: p.usageInfo,
    meetingPoint: p.meetingPoint,
    latitude: p.latitude,
    longitude: p.longitude,
    cancelPolicy: p.cancelPolicy,
    unavailableReason: p.unavailableReason ?? null,
    recommendRank: p.recommendRank,
  };

  const [row] = await tx
    .insert(schema.products)
    .values(values)
    // 평점 캐시(rating_avg, review_count)는 덮어쓰지 않는다 — 트리거가 관리
    .onConflictDoUpdate({ target: schema.products.slug, set: values })
    .returning({ id: schema.products.id });
  if (!row) throw new Error(`${p.slug}: upsert 실패`);

  await tx.delete(schema.productImages).where(eq(schema.productImages.productId, row.id));
  await tx.insert(schema.productImages).values(
    p.images.map(([id, alt], position) => ({
      productId: row.id,
      url: photoUrl(id),
      alt,
      position,
    })),
  );

  await tx
    .delete(schema.productItineraryItems)
    .where(eq(schema.productItineraryItems.productId, row.id));
  if (p.itinerary.length > 0) {
    await tx.insert(schema.productItineraryItems).values(
      p.itinerary.map(([time, title, note, type, caution], position) => ({
        productId: row.id,
        position,
        time,
        title,
        note,
        type,
        caution: caution ?? null,
      })),
    );
  }
}

/** 데모 사용자 준비 — Supabase Admin API(비밀 키)로만 auth.users를 안전하게 만들 수 있다 */
async function ensureDemoUsers(): Promise<string[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    console.log("- SUPABASE_SECRET_KEY가 없어 데모 주문·리뷰를 건너뜁니다");
    return null;
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const ids: string[] = [];
  for (const reviewer of SEED_REVIEWERS) {
    const existing = data.users.find((u) => u.email === reviewer.email);
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    // 데모 계정은 로그인용이 아니므로 아무도 모르는 임의 비밀번호를 준다
    const created = await admin.auth.admin.createUser({
      email: reviewer.email,
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
      user_metadata: { name: reviewer.name },
    });
    if (created.error) throw created.error;
    ids.push(created.data.user.id);
  }
  console.log(`✓ 데모 사용자 ${ids.length}명`);
  return ids;
}

type Buyer = { userId: string; name: string; email: string; phone: string };

/**
 * 이용 완료(지난 날짜) 주문을 만든다. 앱에서는 place_order 함수로만 주문이 생기지만,
 * 시드는 "과거에 이미 이용한 주문"이 필요해서(함수는 지난 날짜를 거부한다) 같은 계산으로 직접 넣는다.
 * 이미 있으면(같은 중복 방지 키) 아무것도 하지 않는다.
 */
async function ensurePastOrder(tx: Tx, buyer: Buyer, productSlug: string, useDate: string) {
  const [product] = await tx
    .select()
    .from(schema.products)
    .where(eq(schema.products.slug, productSlug));
  if (!product) throw new Error(`${productSlug}: 상품이 없습니다`);

  const idempotencyKey = stableUuid(`seed-order:${buyer.email}:${productSlug}`);
  const [existing] = await tx
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(
      and(eq(schema.orders.userId, buyer.userId), eq(schema.orders.idempotencyKey, idempotencyKey)),
    );
  if (existing) return product.id;

  const paidOn = addDays(useDate, -14);
  const subtotal = product.adultPrice * 2; // 성인 2명
  const [order] = await tx
    .insert(schema.orders)
    .values({
      orderNo: sql`'YO' || to_char(${paidOn}::date, 'YYMMDD') || '-' || lpad(nextval('public.order_no_seq')::text, 6, '0')`,
      userId: buyer.userId,
      bookerName: buyer.name,
      bookerEmail: buyer.email,
      bookerPhone: buyer.phone,
      totalAmount: subtotal,
      idempotencyKey,
      policyAgreedAt: sql`${paidOn}::timestamptz`,
      paidAt: sql`${paidOn}::timestamptz`,
      createdAt: sql`${paidOn}::timestamptz`,
    })
    .returning({ id: schema.orders.id });
  if (!order) throw new Error(`${productSlug}: 주문 생성 실패`);

  await tx.insert(schema.orderItems).values({
    orderId: order.id,
    productId: product.id,
    productTitle: product.title,
    useDate,
    adultQty: 2,
    childQty: 0,
    adultPrice: product.adultPrice,
    childPrice: product.childPrice,
    subtotal,
    cancelPolicy: product.cancelPolicy,
  });
  return product.id;
}

async function seedOrdersAndReviews(userIds: string[]) {
  let reviewCount = 0;
  await db.transaction(async (tx) => {
    for (const p of SEED_PRODUCTS) {
      for (const [reviewer, rating, content, useDate] of p.reviews) {
        const userId = userIds[reviewer];
        const info = SEED_REVIEWERS[reviewer];
        if (!userId || !info) throw new Error(`${p.slug}: 리뷰 작성자가 없습니다`);

        // 구매 → 이용 → 리뷰 순서를 지킨다 (리뷰 작성일 = 이용일 다음 날)
        const productId = await ensurePastOrder(tx, { userId, ...info }, p.slug, useDate);
        const writtenAt = sql`${addDays(useDate, 1)}::timestamptz`;
        await tx
          .insert(schema.reviews)
          .values({
            userId,
            productId,
            rating,
            content,
            createdAt: writtenAt,
            updatedAt: writtenAt,
          })
          .onConflictDoUpdate({
            target: [schema.reviews.userId, schema.reviews.productId],
            set: { rating: sql`excluded.rating`, content: sql`excluded.content` },
          });
        reviewCount += 1;
      }
    }
  });
  console.log(`✓ 데모 주문·리뷰 ${reviewCount}건 (평점은 트리거가 자동 집계)`);
}

/** 선택: 본인 계정에 이용 완료 주문 1건 → 리뷰 쓰기 흐름을 직접 확인할 수 있다 */
async function seedBuyerOrder() {
  const email = process.env.SEED_BUYER_EMAIL?.trim().toLowerCase();
  if (!email) return;

  const [user] = await db
    .select({ id: schema.profiles.id, name: schema.profiles.displayName })
    .from(schema.profiles)
    .innerJoin(authUsersEmail, eq(authUsersEmail.id, schema.profiles.id))
    .where(eq(authUsersEmail.email, email));
  if (!user) {
    console.log(`- SEED_BUYER_EMAIL(${email}) 계정을 찾지 못해 건너뜁니다`);
    return;
  }

  const [today] = await db.execute<{ d: string }>(sql`select public.seoul_today()::text as d`);
  if (!today) throw new Error("오늘 날짜를 읽지 못했습니다");
  await db.transaction((tx) =>
    ensurePastOrder(
      tx,
      { userId: user.id, name: user.name, email, phone: "010-0000-0000" },
      "kyoto-machiya-tea-ceremony",
      addDays(today.d, -3),
    ),
  );
  console.log(`✓ ${email}에 이용 완료 주문 1건 (교토 다도 체험 — 리뷰 작성 가능)`);
}

async function main() {
  await seedCatalog();
  const userIds = await ensureDemoUsers();
  if (userIds) await seedOrdersAndReviews(userIds);
  await seedBuyerOrder();
}

main()
  .catch((error: unknown) => {
    console.error("✗ 시드 실패:", error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
