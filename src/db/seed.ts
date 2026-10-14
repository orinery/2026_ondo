/**
 * 시드 스크립트 — `npm run db:seed`
 *
 * 여러 번 실행해도 결과가 같다(멱등):
 * - 여행지는 slug 기준으로 upsert, 사진·추천 일정은 지우고 다시 넣는다.
 * - 데모 사용자는 이메일로 찾아서 없을 때만 만든다. 리뷰는 (작성자, 여행지) 기준 upsert.
 *
 * DATABASE_URL(postgres 권한)로 접속하므로 RLS를 우회한다. 시드처럼 관리 작업에만 쓴다.
 */
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";
import { SEED_DESTINATIONS, SEED_REVIEWERS, SEED_REVIEWS } from "./seed-data";

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

const photoUrl = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;

async function seedDestinations() {
  await db.transaction(async (tx) => {
    for (const d of SEED_DESTINATIONS) {
      const [cover] = d.images;
      if (!cover) throw new Error(`${d.slug}: 대표 사진이 없습니다`);

      const values = {
        slug: d.slug,
        name: d.name,
        nameEn: d.nameEn,
        country: d.country,
        theme: d.theme,
        season: d.season,
        bestSeasons: d.bestSeasons,
        summary: d.summary,
        description: d.description,
        imageUrl: photoUrl(cover[0]),
        imageAlt: cover[1],
        latitude: d.latitude,
        longitude: d.longitude,
        flightInfo: d.flightInfo,
        timeDifference: d.timeDifference,
        currency: d.currency,
      };

      const [row] = await tx
        .insert(schema.destinations)
        .values(values)
        // 평점 캐시(rating_avg, review_count)는 덮어쓰지 않는다 — 트리거가 관리
        .onConflictDoUpdate({ target: schema.destinations.slug, set: values })
        .returning({ id: schema.destinations.id });
      if (!row) throw new Error(`${d.slug}: upsert 실패`);

      await tx
        .delete(schema.destinationImages)
        .where(eq(schema.destinationImages.destinationId, row.id));
      await tx.insert(schema.destinationImages).values(
        d.images.map(([id, alt], position) => ({
          destinationId: row.id,
          url: photoUrl(id),
          alt,
          position,
        })),
      );

      await tx
        .delete(schema.destinationItineraryItems)
        .where(eq(schema.destinationItineraryItems.destinationId, row.id));

      // 같은 날 안에서의 순서(position)를 day별로 0부터 매긴다
      const positionByDay = new Map<number, number>();
      await tx.insert(schema.destinationItineraryItems).values(
        d.itinerary.map(([dayNumber, time, title, note, type, caution]) => {
          const position = positionByDay.get(dayNumber) ?? 0;
          positionByDay.set(dayNumber, position + 1);
          return {
            destinationId: row.id,
            dayNumber,
            position,
            time,
            title,
            note,
            type,
            caution: caution ?? null,
          };
        }),
      );
    }
  });
  console.log(`✓ 여행지 ${SEED_DESTINATIONS.length}곳 (사진·추천 일정 포함)`);
}

/** 데모 사용자 준비 — Supabase Admin API(비밀 키)로만 auth.users를 안전하게 만들 수 있다 */
async function ensureDemoUsers(): Promise<string[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    console.log("- SUPABASE_SECRET_KEY가 없어 데모 리뷰를 건너뜁니다");
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

async function seedReviews(userIds: string[]) {
  const rows = await db
    .select({ id: schema.destinations.id, slug: schema.destinations.slug })
    .from(schema.destinations)
    .where(inArray(schema.destinations.slug, Object.keys(SEED_REVIEWS)));
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));

  const values = Object.entries(SEED_REVIEWS).flatMap(([slug, reviews]) =>
    reviews.map(([reviewer, rating, content]) => {
      const userId = userIds[reviewer];
      const destinationId = idBySlug.get(slug);
      if (!userId || !destinationId) throw new Error(`${slug}: 리뷰 대상이 없습니다`);
      return { userId, destinationId, rating, content };
    }),
  );

  await db
    .insert(schema.reviews)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.reviews.userId, schema.reviews.destinationId],
      set: { rating: sql`excluded.rating`, content: sql`excluded.content` },
    });
  console.log(`✓ 데모 리뷰 ${values.length}개 (평점은 트리거가 자동 집계)`);
}

async function main() {
  await seedDestinations();
  const userIds = await ensureDemoUsers();
  if (userIds) await seedReviews(userIds);
}

main()
  .catch((error: unknown) => {
    console.error("✗ 시드 실패:", error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
