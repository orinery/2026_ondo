/**
 * 여운 DB 스키마 (Drizzle) — 테이블 · 제약 조건 · RLS 정책을 한 파일에서 관리한다.
 *
 * 역할 분리 원칙 (사용자 확정):
 * - Drizzle: 스키마 정의, 마이그레이션 생성, 시드, 타입 추론에만 쓴다. (postgres 권한 → RLS 우회)
 * - 앱 실행 중 읽기·쓰기: supabase-js(사용자 JWT)로만 한다. → 아래 RLS 정책이 항상 적용된다.
 *
 * RLS 요약
 * - 공개 데이터(여행지·사진·추천 일정·리뷰·프로필): 누구나 읽기, 쓰기는 정책 없음(= 거부)
 * - 개인 데이터(찜·찜 폴더·여행·일정 항목): 본인만 읽기·쓰기
 * - 리뷰 쓰기·프로필 수정: 본인 행만
 *
 * 여기서 표현할 수 없는 것(트리거, 컬럼 단위 GRANT, Storage 정책)은
 * src/db/migrations/0001_*.sql 커스텀 마이그레이션에 있다.
 */
import { sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

// drizzle-kit이 tsconfig 경로 별칭을 해석하지 못할 수 있어 상대 경로로 가져온다
import { ITEM_TYPE_VALUES, SEASON_VALUES, THEME_VALUES } from "../lib/constants/taxonomy";

// ─── enum ───────────────────────────────────────────────────────────────
export const themeEnum = pgEnum("destination_theme", THEME_VALUES);
export const seasonEnum = pgEnum("season", SEASON_VALUES);
export const itemTypeEnum = pgEnum("itinerary_item_type", ITEM_TYPE_VALUES);

// ─── 공통 컬럼 ───────────────────────────────────────────────────────────
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
// updated_at은 트리거(set_updated_at)가 갱신한다
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// 공개 읽기 정책: 비로그인(anon)과 로그인(authenticated) 모두 SELECT 허용
const publicRead = (name: string) =>
  pgPolicy(name, { for: "select", to: [anonRole, authenticatedRole], using: sql`true` });

// ─── profiles: auth.users와 1:1, 공개 표시 정보만 담는다 ───────────────────
export const profiles = pgTable(
  "profiles",
  {
    // auth.users 행이 지워지면(회원 탈퇴) 프로필과 그에 딸린 모든 개인 데이터가 연쇄 삭제된다
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    termsAgreedAt: timestamp("terms_agreed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("profiles_display_name_length", sql`char_length(${t.displayName}) between 1 and 30`),
    // 리뷰 작성자 이름을 보여줘야 하므로 프로필은 공개 읽기
    publicRead("profiles_select_public"),
    // INSERT는 회원가입 트리거(handle_new_user)가 대신하므로 정책을 두지 않는다
    pgPolicy("profiles_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.id} = ${authUid}`,
      withCheck: sql`${t.id} = ${authUid}`,
    }),
  ],
);

// ─── destinations: 여행지 (관리자 데이터, 앱에서는 읽기 전용) ────────────────
export const destinations = pgTable(
  "destinations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    nameEn: text("name_en").notNull(),
    country: text("country").notNull(),
    theme: themeEnum("theme").notNull(),
    // 대표 계절(카드의 시즌 배지) + 추천 계절 목록(계절 필터) — 사용자 확정
    season: seasonEnum("season").notNull(),
    bestSeasons: seasonEnum("best_seasons").array().notNull(),
    summary: text("summary").notNull(), // 한 줄 소개 (메타 description)
    description: text("description").notNull(), // 상세 "소개" 본문
    imageUrl: text("image_url").notNull(), // 대표 사진 (카드·히어로)
    imageAlt: text("image_alt").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    // 상세 사이드 "여행 정보" (명세 4.3: 시즌·비행·시차·통화)
    flightInfo: text("flight_info"),
    timeDifference: text("time_difference"),
    currency: text("currency"),
    // 값이 있으면 카드가 disabled 상태가 된다 (명세 5.1 Disabled)
    unavailableReason: text("unavailable_reason"),
    // 리뷰 집계 캐시 — reviews 트리거가 갱신한다. 목록에서 매번 집계하지 않기 위해 저장한다
    ratingAvg: numeric("rating_avg", { precision: 2, scale: 1 }).notNull().default("0"),
    reviewCount: integer("review_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check("destinations_season_in_best", sql`${t.season} = any(${t.bestSeasons})`),
    check("destinations_latitude", sql`${t.latitude} between -90 and 90`),
    check("destinations_longitude", sql`${t.longitude} between -180 and 180`),
    index("destinations_theme_idx").on(t.theme),
    // 배열 포함 검색(best_seasons @> '{fall}')용 GIN 인덱스
    index("destinations_best_seasons_idx").using("gin", t.bestSeasons),
    publicRead("destinations_select_public"),
  ],
);

// ─── destination_images: 상세 갤러리 사진 ─────────────────────────────────
export const destinationImages = pgTable(
  "destination_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    position: smallint("position").notNull(),
  },
  (t) => [
    unique("destination_images_position_unique").on(t.destinationId, t.position),
    publicRead("destination_images_select_public"),
  ],
);

// ─── destination_itinerary_items: 상세 페이지 "추천 일정" ─────────────────────
export const destinationItineraryItems = pgTable(
  "destination_itinerary_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    dayNumber: smallint("day_number").notNull(), // 1부터
    position: smallint("position").notNull(),
    time: time("time"),
    title: text("title").notNull(),
    note: text("note"),
    type: itemTypeEnum("type").notNull(),
    caution: text("caution"), // 주의 메모 (예: 월요일 휴관)
  },
  (t) => [
    check("destination_itinerary_items_day", sql`${t.dayNumber} >= 1`),
    unique("destination_itinerary_items_order_unique").on(t.destinationId, t.dayNumber, t.position),
    publicRead("destination_itinerary_items_select_public"),
  ],
);

// ─── like_folders: 찜 폴더 ("가을 후보" 등) ───────────────────────────────
export const likeFolders = pgTable(
  "like_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // 기본값 auth.uid(): 클라이언트가 user_id를 보내지 않아도 본인 것으로 저장된다
    userId: uuid("user_id")
      .notNull()
      .default(sql`auth.uid()`)
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("like_folders_name_length", sql`char_length(${t.name}) between 1 and 20`),
    unique("like_folders_user_name_unique").on(t.userId, t.name),
    pgPolicy("like_folders_owner_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
  ],
);

// ─── likes: 찜 (사용자 × 여행지, 폴더는 0~1개 — 사용자 확정) ─────────────────
export const likes = pgTable(
  "likes",
  {
    userId: uuid("user_id")
      .notNull()
      .default(sql`auth.uid()`)
      .references(() => profiles.id, { onDelete: "cascade" }),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    // 폴더를 지우면 찜은 남기고 "폴더 없음"으로 돌린다
    folderId: uuid("folder_id").references(() => likeFolders.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    // 같은 여행지를 두 번 찜할 수 없다
    primaryKey({ name: "likes_pkey", columns: [t.userId, t.destinationId] }),
    index("likes_folder_idx").on(t.folderId),
    pgPolicy("likes_owner_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
      // 남의 폴더에 넣는 것을 막는다: 폴더가 있으면 그 폴더도 본인 것이어야 한다
      withCheck: sql`${t.userId} = ${authUid} and (${t.folderId} is null or exists (
        select 1 from public.like_folders f where f.id = ${t.folderId} and f.user_id = ${authUid}
      ))`,
    }),
  ],
);

// ─── trips: 여행 (일정 플래너의 상위 단위) ────────────────────────────────
export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .default(sql`auth.uid()`)
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("trips_title_length", sql`char_length(${t.title}) between 1 and 50`),
    check("trips_date_order", sql`${t.endDate} >= ${t.startDate}`),
    // 최대 30일 — Day 탭이 지나치게 늘어나는 것을 막는다
    check("trips_max_days", sql`${t.endDate} - ${t.startDate} <= 29`),
    index("trips_user_idx").on(t.userId),
    pgPolicy("trips_owner_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
  ],
);

// ─── trip_items: 날짜별 일정 항목 (여행지 연결 또는 자유 장소 — 사용자 확정) ─────
export const tripItems = pgTable(
  "trip_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    dayIndex: smallint("day_index").notNull(), // 0 = 여행 첫날
    position: integer("position").notNull(), // 같은 날 안의 순서
    title: text("title").notNull(),
    time: time("time"),
    type: itemTypeEnum("type").notNull().default("sight"),
    note: text("note"),
    caution: text("caution"), // 주의 메모 → 타임라인 disabled(휴무) 표시
    // 여행지와 연결되면 동선 지도에 좌표로 표시된다. 여행지가 지워져도 항목은 남긴다
    destinationId: uuid("destination_id").references(() => destinations.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    check("trip_items_day_index", sql`${t.dayIndex} between 0 and 29`),
    check("trip_items_title_length", sql`char_length(${t.title}) between 1 and 60`),
    check("trip_items_note_length", sql`${t.note} is null or char_length(${t.note}) <= 200`),
    check(
      "trip_items_caution_length",
      sql`${t.caution} is null or char_length(${t.caution}) <= 60`,
    ),
    index("trip_items_order_idx").on(t.tripId, t.dayIndex, t.position),
    // 항목에는 user_id가 없으므로 "상위 여행이 본인 것인지"로 소유권을 판단한다
    pgPolicy("trip_items_owner_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.trips tr where tr.id = ${t.tripId} and tr.user_id = ${authUid})`,
      withCheck: sql`exists (select 1 from public.trips tr where tr.id = ${t.tripId} and tr.user_id = ${authUid})`,
    }),
  ],
);

// ─── reviews: 리뷰 (별점 + 텍스트 + 사진 1장, 여행지당 1개 — 사용자 확정) ─────────
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // profiles를 참조해야 supabase-js에서 reviews → profiles(display_name) 조인이 된다
    userId: uuid("user_id")
      .notNull()
      .default(sql`auth.uid()`)
      .references(() => profiles.id, { onDelete: "cascade" }),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    content: text("content").notNull(),
    // Storage(review-photos 버킷)의 객체 경로: "{user_id}/{파일명}"
    photoPath: text("photo_path"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
    check("reviews_content_length", sql`char_length(${t.content}) between 10 and 1000`),
    unique("reviews_user_destination_unique").on(t.userId, t.destinationId),
    index("reviews_destination_created_idx").on(t.destinationId, t.createdAt),
    publicRead("reviews_select_public"),
    pgPolicy("reviews_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
    pgPolicy("reviews_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
    pgPolicy("reviews_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
    }),
  ],
);
