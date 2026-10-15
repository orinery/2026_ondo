/**
 * RLS·권한 검증 스크립트 — `npm run db:verify-rls`
 *
 * 실제 DB에서 anon / 사용자 A / 사용자 B 역할로 쿼리를 실행해
 * "본인 데이터만 읽고 쓸 수 있는지"를 확인한다.
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

      const [dest] = await tx<{ id: string }[]>`select id from public.destinations limit 1`;
      if (!dest) throw new Error("여행지가 없습니다. 먼저 npm run db:seed를 실행하세요.");

      // ── 회원가입 트리거
      const [profile] = await tx<
        { display_name: string }[]
      >`select display_name from public.profiles where id = ${userA}`;
      results.push({
        name: "가입 트리거가 profiles 생성",
        ok: profile?.display_name === "검증A",
        detail: profile?.display_name ?? "없음",
      });

      // ── 공개 데이터
      await expectOk(tx, "anon: 여행지 읽기", anon, async (sp) => {
        const rows = await sp`select id from public.destinations`;
        return `${rows.length}행`;
      });
      await expectBlocked(tx, "anon: 여행지 추가", anon, async (sp) => {
        const r = await sp`insert into public.destinations (slug) values ('x')`;
        return r.count;
      });
      await expectBlocked(tx, "사용자: 여행지 수정", A, async (sp) => {
        const r = await sp`update public.destinations set name = '해킹' where id = ${dest.id}`;
        return r.count;
      });

      // ── 여행·일정
      const [tripA] = await as(
        tx,
        A,
        (sp) => sp<{ id: string }[]>`
        insert into public.trips (title, start_date, end_date) values ('A의 여행', '2026-11-02', '2026-11-04') returning id`,
      );
      if (!tripA) throw new Error("A의 여행 생성 실패");
      results.push({ name: "A: 여행 생성 (user_id 자동 = 본인)", ok: true, detail: tripA.id });

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
      await expectOk(tx, "A: 본인 여행에 일정 항목 추가", A, async (sp) => {
        const r =
          await sp`insert into public.trip_items (trip_id, day_index, position, title) values (${tripA.id}, 0, 0, '기온 산책')`;
        return `${r.count}행`;
      });

      // 7단계 순서 변경 함수(reorder_trip_items): security invoker라 RLS가 적용돼야 한다
      const [second] = await as(
        tx,
        A,
        (sp) => sp<{ id: string }[]>`
        insert into public.trip_items (trip_id, day_index, position, title) values (${tripA.id}, 0, 1, '폰토초 저녁') returning id`,
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
      results.push({
        name: "B: A의 일정 순서 바꾸기 (RPC)",
        ok: afterB === beforeOrder,
        detail: afterB === beforeOrder ? `변화 없음 (${afterB})` : `✗ 바뀜: ${afterB}`,
      });
      await as(
        tx,
        A,
        (sp) => sp`select public.reorder_trip_items(${tripA.id}, 0::smallint, ${reversed}::uuid[])`,
      );
      const afterA = await order();
      results.push({
        name: "A: 본인 일정 순서 바꾸기 (RPC)",
        ok: Boolean(second) && afterA !== beforeOrder,
        detail: `${beforeOrder} ⇒ ${afterA}`,
      });
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
            await sp`insert into public.likes (destination_id, folder_id) values (${dest.id}, ${folderA.id})`
          ).count,
      );
      await expectOk(tx, "B: 폴더 없이 찜하기", B, async (sp) => {
        const r = await sp`insert into public.likes (destination_id) values (${dest.id})`;
        return `${r.count}행`;
      });
      await expectBlocked(
        tx,
        "A: B의 찜 읽기",
        A,
        async (sp) => (await sp`select 1 from public.likes where user_id = ${userB}`).length,
      );
      // 6단계 "폴더 이동": 본인 찜이라도 남의 폴더로는 옮길 수 없어야 한다
      await expectBlocked(
        tx,
        "B: 내 찜을 A의 폴더로 이동",
        B,
        async (sp) =>
          (
            await sp`update public.likes set folder_id = ${folderA.id} where destination_id = ${dest.id}`
          ).count,
      );

      // ── Storage (리뷰 사진): 경로 첫 폴더가 본인 id여야 업로드 가능
      // (실제 앱은 Storage API로 올리지만, 같은 RLS 정책이 storage.objects 테이블에 걸려 있다)
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

      // ── 리뷰
      const [reviewA] = await as(
        tx,
        A,
        (sp) => sp<{ id: string }[]>`
        insert into public.reviews (destination_id, rating, content) values (${dest.id}, 5, '정말 좋았던 여행이에요!') returning id`,
      );
      if (!reviewA) throw new Error("A의 리뷰 생성 실패");
      await expectOk(
        tx,
        "anon: 리뷰 읽기",
        anon,
        async (sp) =>
          `${(await sp`select 1 from public.reviews where id = ${reviewA.id}`).length}행`,
      );
      await expectBlocked(
        tx,
        "A: 같은 여행지에 리뷰 2개",
        A,
        async (sp) =>
          (
            await sp`insert into public.reviews (destination_id, rating, content) values (${dest.id}, 4, '두 번째 리뷰입니다요')`
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
        "A: 리뷰의 여행지 바꾸기 (컬럼 권한)",
        A,
        async (sp) =>
          (await sp`update public.reviews set destination_id = ${dest.id} where id = ${reviewA.id}`)
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
        select review_count from public.destinations where id = ${dest.id}`;
      results.push({
        name: "리뷰 트리거가 평점 캐시 갱신",
        ok: (cache?.review_count ?? 0) >= 1,
        detail: `review_count=${cache?.review_count}`,
      });

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
