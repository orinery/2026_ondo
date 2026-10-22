/**
 * 여운 DB 스키마 (Drizzle) — 테이블 · 제약 조건 · RLS 정책을 한 파일에서 관리한다.
 *
 * 역할 분리 원칙 (사용자 확정):
 * - Drizzle: 스키마 정의, 마이그레이션 생성, 시드, 타입 추론에만 쓴다. (postgres 권한 → RLS 우회)
 * - 앱 실행 중 읽기·쓰기: supabase-js(사용자 JWT)로만 한다. → 아래 RLS 정책이 항상 적용된다.
 *
 * RLS 요약
 * - 역할(profiles.role): customer · partner · admin. 판단은 is_admin()·my_partner_id() 함수로 한다 (0008)
 *   → 로그인 사용자는 모두 DB 역할 authenticated라서 컬럼 GRANT로는 파트너·관리자를 나눌 수 없기 때문
 * - 공개 데이터(도시·공개된 상품·사진·진행 일정·취소 규정·리뷰·프로필): 누구나 읽기
 * - 상품: 파트너는 본인 상품만 만들고 고친다. 관리자는 전체 읽기, 판매 중지는 함수로
 * - 파트너·파트너 신청: 본인 + 관리자만 읽기. 승인·거절·정지는 관리자 함수로만
 * - 개인 데이터(장바구니·찜·찜 폴더·여행·일정 항목): 본인만 읽기·쓰기
 * - 주문·주문 항목: 본인 것 **읽기만**. 만들기·취소는 DB 함수(place_order·cancel_order)로만 한다
 *   → 금액을 클라이언트가 정할 수 없게 하기 위해서다 (가격은 함수가 products에서 다시 계산)
 * - 리뷰 쓰기: 본인 행 + 이용일이 지난 구매 내역이 있을 때만 (has_used_product)
 *
 * 여기서 표현할 수 없는 것(트리거, 함수, 컬럼 단위 GRANT, Storage 정책)은
 * src/db/migrations/0001·0005 커스텀 마이그레이션에 있다.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
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
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

// drizzle-kit이 tsconfig 경로 별칭을 해석하지 못할 수 있어 상대 경로로 가져온다
import {
  APPLICATION_STATUS_VALUES,
  CATEGORY_VALUES,
  CONFIRMATION_MODE_VALUES,
  ITEM_TYPE_VALUES,
  OPTION_UNIT_VALUES,
  ORDER_ITEM_STATUS_VALUES,
  ORDER_STATUS_VALUES,
  PARTNER_STATUS_VALUES,
  REPORT_REASON_VALUES,
  REPORT_STATUS_VALUES,
  THEME_VALUES,
  USER_ROLE_VALUES,
} from "../lib/constants/taxonomy";

// ─── enum ───────────────────────────────────────────────────────────────
export const categoryEnum = pgEnum("product_category", CATEGORY_VALUES);
export const themeEnum = pgEnum("product_theme", THEME_VALUES);
export const orderStatusEnum = pgEnum("order_status", ORDER_STATUS_VALUES);
export const itemTypeEnum = pgEnum("itinerary_item_type", ITEM_TYPE_VALUES);
export const userRoleEnum = pgEnum("user_role", USER_ROLE_VALUES);
export const partnerStatusEnum = pgEnum("partner_status", PARTNER_STATUS_VALUES);
export const applicationStatusEnum = pgEnum("application_status", APPLICATION_STATUS_VALUES);
export const confirmationModeEnum = pgEnum("confirmation_mode", CONFIRMATION_MODE_VALUES);
export const orderItemStatusEnum = pgEnum("order_item_status", ORDER_ITEM_STATUS_VALUES);
export const optionUnitEnum = pgEnum("option_unit", OPTION_UNIT_VALUES);
export const reportReasonEnum = pgEnum("report_reason", REPORT_REASON_VALUES);
export const reportStatusEnum = pgEnum("report_status", REPORT_STATUS_VALUES);

// ─── 공통 컬럼 ───────────────────────────────────────────────────────────
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
// updated_at은 트리거(set_updated_at)가 갱신한다
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// 공개 읽기 정책: 비로그인(anon)과 로그인(authenticated) 모두 SELECT 허용
const publicRead = (name: string) =>
  pgPolicy(name, { for: "select", to: [anonRole, authenticatedRole], using: sql`true` });

// 역할 헬퍼 (0008 커스텀 마이그레이션의 security definer 함수).
// (select …)로 감싸면 Postgres가 쿼리당 한 번만 평가한다 (행마다 호출하지 않음)
const isAdmin = sql`(select public.is_admin())`;
const myPartnerId = sql`(select public.my_partner_id())`;

// 상품에 딸린 데이터(회차·옵션) 쓰기: 상품이 내 파트너 것일 때만
const ownProduct = (productId: AnyPgColumn) =>
  sql`exists (select 1 from public.products p where p.id = ${productId} and p.partner_id = ${myPartnerId})`;
const partnerWrite = (name: string, productCheck: ReturnType<typeof sql>) => [
  pgPolicy(`${name}_insert_partner`, {
    for: "insert",
    to: authenticatedRole,
    withCheck: productCheck,
  }),
  pgPolicy(`${name}_update_partner`, {
    for: "update",
    to: authenticatedRole,
    using: productCheck,
    withCheck: productCheck,
  }),
  pgPolicy(`${name}_delete_partner`, { for: "delete", to: authenticatedRole, using: productCheck }),
];

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
    // 프로필은 공개지만 이 컬럼만 읽기 권한을 주지 않는다(0010). 바꾸는 길은 관리자 함수뿐
    role: userRoleEnum("role").notNull().default("customer"),
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

// ─── partners: 판매자(파트너) ─────────────────────────────────────────────
// owner_user_id가 비어 있으면 로그인 계정이 없는 파트너다 (여운 직영, 시드 데모 파트너)
export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .unique("partners_owner_unique")
      .references(() => profiles.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    contactEmail: text("contact_email").notNull(),
    intro: text("intro").notNull(),
    status: partnerStatusEnum("status").notNull().default("active"),
    // 플랫폼 수수료율(%). 주문할 때 주문 항목에 복사해 두므로 바꿔도 지난 주문 정산은 그대로다
    commissionRate: numeric("commission_rate", { precision: 4, scale: 2 }).notNull().default("15"),
    createdAt: createdAt(),
  },
  (t) => [
    check("partners_name_length", sql`char_length(${t.name}) between 1 and 40`),
    check("partners_commission_rate", sql`${t.commissionRate} between 0 and 50`),
    pgPolicy("partners_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.ownerUserId} = ${authUid}`,
    }),
    pgPolicy("partners_select_admin", { for: "select", to: authenticatedRole, using: isAdmin }),
  ],
);

// ─── partner_applications: 파트너 신청 → 관리자 승인/거절 ─────────────────────
export const partnerApplications = pgTable(
  "partner_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .default(sql`auth.uid()`)
      .references(() => profiles.id, { onDelete: "cascade" }),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    contactEmail: text("contact_email").notNull(),
    intro: text("intro").notNull(),
    status: applicationStatusEnum("status").notNull().default("pending"),
    rejectReason: text("reject_reason"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "partner_applications_business_name",
      sql`char_length(${t.businessName}) between 1 and 40`,
    ),
    check("partner_applications_contact_name", sql`char_length(${t.contactName}) between 1 and 30`),
    // 사업자 연락처라 휴대폰뿐 아니라 일반 전화(02-123-4567)도 허용한다
    check(
      "partner_applications_contact_phone",
      sql`${t.contactPhone} ~ '^0[0-9]{1,2}-[0-9]{3,4}-[0-9]{4}$'`,
    ),
    check(
      "partner_applications_contact_email",
      sql`char_length(${t.contactEmail}) <= 254 and ${t.contactEmail} like '%_@_%'`,
    ),
    check("partner_applications_intro", sql`char_length(${t.intro}) between 10 and 500`),
    check(
      "partner_applications_reject_reason",
      sql`${t.rejectReason} is null or char_length(${t.rejectReason}) between 1 and 200`,
    ),
    // 검토 중인 신청은 한 사람당 하나 (거절된 뒤에는 다시 신청할 수 있다)
    uniqueIndex("partner_applications_pending_unique")
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
    index("partner_applications_status_idx").on(t.status, t.createdAt),
    pgPolicy("partner_applications_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
    pgPolicy("partner_applications_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
    }),
    pgPolicy("partner_applications_select_admin", {
      for: "select",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ],
);

// ─── cities: 도시 (상품 분류 · 메인 바로가기) ──────────────────────────────
export const cities = pgTable(
  "cities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    nameEn: text("name_en").notNull(),
    summary: text("summary").notNull(),
    imageUrl: text("image_url").notNull(),
    imageAlt: text("image_alt").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    position: smallint("position").notNull(), // 화면 표시 순서
  },
  () => [publicRead("cities_select_public")],
);

// ─── cancellation_policies: 취소 규정 (예: 7일 전 100% · 3일 전 50% …) ─────────
export const cancellationPolicies = pgTable(
  "cancellation_policies",
  {
    // 코드(flexible·standard·strict)를 키로 써서 주문 항목에 그대로 복사해 둔다
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
  },
  () => [publicRead("cancellation_policies_select_public")],
);

// 구간: "이용일 days_before일 전까지 취소하면 refund_rate% 환불"
// 남은 일수 이하인 구간 중 days_before가 가장 큰 것을 적용한다 (refund_quote 함수)
export const cancellationPolicyTiers = pgTable(
  "cancellation_policy_tiers",
  {
    policyCode: text("policy_code")
      .notNull()
      .references(() => cancellationPolicies.code, { onDelete: "cascade" }),
    daysBefore: smallint("days_before").notNull(),
    refundRate: smallint("refund_rate").notNull(),
  },
  (t) => [
    primaryKey({ name: "cancellation_policy_tiers_pkey", columns: [t.policyCode, t.daysBefore] }),
    check("cancellation_policy_tiers_days", sql`${t.daysBefore} between 0 and 60`),
    check("cancellation_policy_tiers_rate", sql`${t.refundRate} between 0 and 100`),
    publicRead("cancellation_policy_tiers_select_public"),
  ],
);

// ─── products: 판매 상품 — 파트너가 본인 상품을 만들고 고친다 ──────────────────────
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    // 기본값: 파트너가 상품을 만들면 본인 파트너로 저장된다 (user_id default auth.uid()와 같은 방식).
    // 사용자는 이 컬럼을 쓸 수 없다(GRANT 없음)
    partnerId: uuid("partner_id")
      .notNull()
      .default(sql`public.my_partner_id()`)
      .references(() => partners.id, { onDelete: "restrict" }),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "restrict" }),
    category: categoryEnum("category").notNull(),
    theme: themeEnum("theme").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(), // 한 줄 소개 (카드·메타 description)
    description: text("description").notNull(), // 상세 "상품 소개" 본문
    highlights: text("highlights")
      .array()
      .notNull()
      .default(sql`'{}'`),
    imageUrl: text("image_url").notNull(), // 대표 사진 (카드)
    imageAlt: text("image_alt").notNull(),
    // 가격은 원(KRW) 정수. 아동 가격이 없으면 성인 전용 상품
    adultPrice: integer("adult_price").notNull(),
    childPrice: integer("child_price"),
    // 정가 — 있으면 할인 전 가격으로 취소선 표시
    listAdultPrice: integer("list_adult_price"),
    // 운영 요일 (ISO 요일: 1=월 … 7=일)
    operatingDays: smallint("operating_days").array().notNull(),
    // 예약 마감: 이용일 N일 전까지 (0 = 당일까지)
    cutoffDays: smallint("cutoff_days").notNull().default(1),
    maxQty: smallint("max_qty").notNull().default(10), // 한 번에 예약할 수 있는 총 인원
    startTime: time("start_time"),
    durationText: text("duration_text").notNull(), // "약 4시간", "1일권" 등 표시용
    includes: text("includes")
      .array()
      .notNull()
      .default(sql`'{}'`),
    excludes: text("excludes")
      .array()
      .notNull()
      .default(sql`'{}'`),
    usageInfo: text("usage_info")
      .array()
      .notNull()
      .default(sql`'{}'`),
    meetingPoint: text("meeting_point").notNull(), // 투어 = 만나는 장소, 티켓 = 이용 장소
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    cancelPolicy: text("cancel_policy")
      .notNull()
      .references(() => cancellationPolicies.code),
    // 값이 있으면 판매 중지 — 카드 disabled 상태(명세 5.1)와 예약 불가에 쓴다
    unavailableReason: text("unavailable_reason"),
    recommendRank: smallint("recommend_rank"), // 추천순 정렬·메인 노출 (작을수록 먼저)
    // 예약 확정 방식 — manual이면 결제 후 파트너가 확정할 때까지 "확정 대기"
    confirmationMode: confirmationModeEnum("confirmation_mode").notNull().default("instant"),
    // null = 임시 저장(파트너·관리자만 볼 수 있음), 값이 있으면 공개(판매 시작)
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // 관리자 판매 중지 — 파트너는 이 컬럼을 쓸 수 없다(GRANT 없음)
    suspendedReason: text("suspended_reason"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    // 리뷰 집계 캐시 — reviews 트리거가 갱신한다. 목록에서 매번 집계하지 않기 위해 저장한다
    ratingAvg: numeric("rating_avg", { precision: 2, scale: 1 }).notNull().default("0"),
    reviewCount: integer("review_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check("products_title_length", sql`char_length(${t.title}) between 1 and 60`),
    check("products_adult_price", sql`${t.adultPrice} > 0`),
    check("products_child_price", sql`${t.childPrice} is null or ${t.childPrice} >= 0`),
    check(
      "products_list_price",
      sql`${t.listAdultPrice} is null or ${t.listAdultPrice} > ${t.adultPrice}`,
    ),
    check(
      "products_operating_days",
      sql`cardinality(${t.operatingDays}) >= 1 and ${t.operatingDays} <@ '{1,2,3,4,5,6,7}'::smallint[]`,
    ),
    check("products_cutoff_days", sql`${t.cutoffDays} between 0 and 30`),
    check("products_max_qty", sql`${t.maxQty} between 1 and 20`),
    // 파트너 확정이 필요한 상품은 이용일 하루 전에는 마감해야 확정할 시간이 생긴다
    check("products_manual_cutoff", sql`${t.confirmationMode} = 'instant' or ${t.cutoffDays} >= 1`),
    check("products_latitude", sql`${t.latitude} between -90 and 90`),
    check("products_longitude", sql`${t.longitude} between -180 and 180`),
    index("products_city_idx").on(t.cityId),
    index("products_category_theme_idx").on(t.category, t.theme),
    index("products_partner_idx").on(t.partnerId),
    // 공개된 상품만 누구나 볼 수 있다. 임시 저장 상품은 소유 파트너와 관리자만
    pgPolicy("products_select_public", {
      for: "select",
      to: [anonRole, authenticatedRole],
      using: sql`${t.publishedAt} is not null`,
    }),
    pgPolicy("products_select_partner_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.partnerId} = ${myPartnerId}`,
    }),
    pgPolicy("products_select_admin", { for: "select", to: authenticatedRole, using: isAdmin }),
    // 활동 중인 파트너만 본인 상품을 만들고 고칠 수 있다 (my_partner_id()는 정지된 파트너면 null)
    pgPolicy("products_insert_partner", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.partnerId} = ${myPartnerId}`,
    }),
    pgPolicy("products_update_partner", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.partnerId} = ${myPartnerId}`,
      withCheck: sql`${t.partnerId} = ${myPartnerId}`,
    }),
  ],
);

// ─── product_images: 상세 갤러리 사진 ─────────────────────────────────────
export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    position: smallint("position").notNull(),
  },
  (t) => [
    unique("product_images_position_unique").on(t.productId, t.position),
    publicRead("product_images_select_public"),
    // 파트너는 본인 상품의 사진을 바꾼다 (save_product 함수가 지우고 다시 넣는다)
    ...partnerWrite("product_images", ownProduct(t.productId)),
  ],
);

// ─── product_itinerary_items: 투어 "진행 일정" (하루 코스) ──────────────────────
export const productItineraryItems = pgTable(
  "product_itinerary_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    time: time("time"),
    title: text("title").notNull(),
    note: text("note"),
    type: itemTypeEnum("type").notNull(),
    caution: text("caution"),
  },
  (t) => [
    unique("product_itinerary_items_order_unique").on(t.productId, t.position),
    publicRead("product_itinerary_items_select_public"),
    ...partnerWrite("product_itinerary_items", ownProduct(t.productId)),
  ],
);

// ─── product_slots: 회차 (예: 10:00 / 14:00) — 회차마다 기본 정원 ────────────────
// start_time이 null이면 시간이 없는 상품(종일권·패스)의 단일 회차
export const productSlots = pgTable(
  "product_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    startTime: time("start_time"),
    capacity: smallint("capacity").notNull().default(30), // 날짜별로 덮어쓰지 않았을 때의 정원
    // 예약이 있는 회차는 지우지 않고 판매만 끈다 (주문 항목이 참조한다)
    active: boolean("active").notNull().default(true),
    position: smallint("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check("product_slots_capacity", sql`${t.capacity} between 1 and 999`),
    // 같은 상품에 같은 시간 회차는 하나 (시간 없는 회차도 하나 — NULL끼리도 중복으로 본다)
    unique("product_slots_product_time_unique").on(t.productId, t.startTime).nullsNotDistinct(),
    publicRead("product_slots_select_public"),
    ...partnerWrite("product_slots", ownProduct(t.productId)),
  ],
);

// ─── slot_inventory: 날짜 × 회차 재고 — 덮어쓰기(정원·마감·가격) + 예약된 인원 카운터 ──────
// 행은 필요할 때 생긴다 (파트너가 덮어쓰거나, 첫 예약이 들어올 때). 행이 없으면 회차 기본값.
// booked는 place_order·취소·거절·만료 함수만 바꾼다 (GRANT 없음) → 남은 자리 = 정원 - booked
export const slotInventory = pgTable(
  "slot_inventory",
  {
    slotId: uuid("slot_id")
      .notNull()
      .references(() => productSlots.id, { onDelete: "cascade" }),
    useDate: date("use_date").notNull(),
    capacity: smallint("capacity"), // null = 회차 기본 정원
    closed: boolean("closed").notNull().default(false), // 이 날짜·회차만 판매 마감
    adultPrice: integer("adult_price"), // null = 상품 기본 가격
    childPrice: integer("child_price"),
    booked: smallint("booked").notNull().default(0),
  },
  (t) => [
    primaryKey({ name: "slot_inventory_pkey", columns: [t.slotId, t.useDate] }),
    check("slot_inventory_capacity", sql`${t.capacity} is null or ${t.capacity} between 0 and 999`),
    check("slot_inventory_booked", sql`${t.booked} >= 0`),
    check("slot_inventory_adult_price", sql`${t.adultPrice} is null or ${t.adultPrice} > 0`),
    check("slot_inventory_child_price", sql`${t.childPrice} is null or ${t.childPrice} >= 0`),
    publicRead("slot_inventory_select_public"),
    ...partnerWrite(
      "slot_inventory",
      sql`exists (select 1 from public.product_slots s join public.products p on p.id = s.product_id
                  where s.id = ${t.slotId} and p.partner_id = ${myPartnerId})`,
    ),
  ],
);

// ─── product_options: 추가 옵션 (예: 호텔 픽업 +10,000원/건, 점심 +2,500원/인) ─────────
export const productOptions = pgTable(
  "product_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    unit: optionUnitEnum("unit").notNull().default("per_booking"),
    active: boolean("active").notNull().default(true),
    position: smallint("position").notNull().default(0),
  },
  (t) => [
    check("product_options_name_length", sql`char_length(${t.name}) between 1 and 30`),
    check("product_options_price", sql`${t.price} between 0 and 1000000`),
    unique("product_options_product_name_unique").on(t.productId, t.name),
    publicRead("product_options_select_public"),
    ...partnerWrite("product_options", ownProduct(t.productId)),
  ],
);

// ─── cart_items: 장바구니 (로그인 사용자, DB 저장) ───────────────────────────
// 가격 컬럼이 없다: 장바구니는 항상 "현재 가격"으로 보여주고, 결제 금액은 place_order가 계산한다.
// 예약 가능 여부(요일·마감·인원)는 BEFORE 트리거(validate_cart_item)가 검사한다.
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .default(sql`auth.uid()`)
      .references(() => profiles.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // 회차. 비워서 넣으면 트리거가 상품의 첫 회차로 채운다 (회차 선택 전 화면과의 호환)
    slotId: uuid("slot_id")
      .notNull()
      .references(() => productSlots.id, { onDelete: "cascade" }),
    useDate: date("use_date").notNull(),
    adultQty: smallint("adult_qty").notNull().default(1),
    childQty: smallint("child_qty").notNull().default(0),
    // 고른 추가 옵션 id. 짧게 머무는 데이터라 배열로 두고, 유효성은 트리거(booking_error)가 확인한다
    optionIds: uuid("option_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "cart_items_qty",
      sql`${t.adultQty} >= 0 and ${t.childQty} >= 0 and ${t.adultQty} + ${t.childQty} >= 1`,
    ),
    // 같은 회차·같은 날짜는 한 줄로 합친다 (담기 액션이 수량을 더하고 옵션은 새 선택으로 바꾼다)
    unique("cart_items_user_slot_date_unique").on(t.userId, t.slotId, t.useDate),
    pgPolicy("cart_items_owner_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
  ],
);

// ─── orders: 주문 (모의 결제) ─────────────────────────────────────────────
// INSERT·UPDATE 정책이 없다 = 사용자가 직접 만들거나 고칠 수 없다. place_order·cancel_order 함수만 쓴다.
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNo: text("order_no").notNull().unique(), // 화면·URL용 번호: YO261015-000123
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: orderStatusEnum("status").notNull().default("paid"),
    bookerName: text("booker_name").notNull(),
    bookerEmail: text("booker_email").notNull(),
    bookerPhone: text("booker_phone").notNull(),
    totalAmount: integer("total_amount").notNull(),
    refundAmount: integer("refund_amount"), // 취소 시 확정된 환불액
    paymentMethod: text("payment_method").notNull().default("demo"),
    // 중복 결제 방지 키: 결제 버튼을 두 번 누르거나 재시도해도 주문이 하나만 생긴다
    idempotencyKey: uuid("idempotency_key").notNull(),
    policyAgreedAt: timestamp("policy_agreed_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("orders_booker_name", sql`char_length(${t.bookerName}) between 1 and 30`),
    check(
      "orders_booker_email",
      sql`char_length(${t.bookerEmail}) <= 254 and ${t.bookerEmail} like '%_@_%'`,
    ),
    check("orders_booker_phone", sql`${t.bookerPhone} ~ '^01[016789]-[0-9]{3,4}-[0-9]{4}$'`),
    check("orders_total_amount", sql`${t.totalAmount} > 0`),
    check(
      "orders_refund_amount",
      sql`${t.refundAmount} is null or ${t.refundAmount} between 0 and ${t.totalAmount}`,
    ),
    unique("orders_user_idempotency_unique").on(t.userId, t.idempotencyKey),
    index("orders_user_created_idx").on(t.userId, t.createdAt),
    pgPolicy("orders_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
    }),
    // 파트너에게는 orders 정책을 주지 않는다: 한 주문에 다른 파트너 상품이 섞이면 총액 등이 보이기 때문.
    // 파트너는 자기 주문 항목(order_items)과, 예약자 연락처는 함수(partner_bookings, S4)로만 본다
    pgPolicy("orders_select_admin", { for: "select", to: authenticatedRole, using: isAdmin }),
  ],
);

// ─── order_items: 주문 항목 — 구매 시점의 상품명·단가·취소 규정을 복사해 둔다 ─────────
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    // 주문 이력이 있는 상품은 지울 수 없다 (판매 중지는 unavailable_reason으로)
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productTitle: text("product_title").notNull(),
    useDate: date("use_date").notNull(),
    adultQty: smallint("adult_qty").notNull(),
    childQty: smallint("child_qty").notNull(),
    adultPrice: integer("adult_price").notNull(),
    childPrice: integer("child_price"),
    subtotal: integer("subtotal").notNull(), // 인원 금액 + 옵션 금액
    cancelPolicy: text("cancel_policy")
      .notNull()
      .references(() => cancellationPolicies.code),
    refundAmount: integer("refund_amount"),
    // ── 회차·옵션·확정 (S2)
    status: orderItemStatusEnum("status").notNull().default("confirmed"),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => productSlots.id, { onDelete: "restrict" }),
    startTime: time("start_time"), // 구매 시점의 회차 시간 (회차가 바뀌어도 그대로)
    optionsAmount: integer("options_amount").notNull().default(0),
    // 정산용 스냅숏: 주문할 때의 판매 파트너와 수수료율
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict" }),
    commissionRate: numeric("commission_rate", { precision: 4, scale: 2 }).notNull(),
    voucherCode: text("voucher_code").unique("order_items_voucher_unique"), // 확정되면 발급
    confirmDeadline: timestamp("confirm_deadline", { withTimezone: true }), // 확정 대기의 처리 기한
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectReason: text("reject_reason"),
    usedAt: timestamp("used_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    // 운영자 취소(admin_cancel_item) 사유 — 고객 예약 내역에 보인다. 고객 본인 취소는 null
    cancelReason: text("cancel_reason"),
  },
  (t) => [
    check("order_items_qty", sql`${t.adultQty} >= 0 and ${t.childQty} >= 0`),
    check("order_items_subtotal", sql`${t.subtotal} > 0`),
    check("order_items_options_amount", sql`${t.optionsAmount} >= 0`),
    index("order_items_order_idx").on(t.orderId),
    index("order_items_partner_date_idx").on(t.partnerId, t.useDate),
    // 기한 지난 확정 대기를 찾는 만료 작업용
    index("order_items_pending_deadline_idx")
      .on(t.confirmDeadline)
      .where(sql`${t.status} = 'pending'`),
    // 리뷰 자격 확인(has_used_product)용
    index("order_items_product_date_idx").on(t.productId, t.useDate),
    pgPolicy("order_items_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.orders o where o.id = ${t.orderId} and o.user_id = ${authUid})`,
    }),
    pgPolicy("order_items_select_partner", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.partnerId} = ${myPartnerId}`,
    }),
    pgPolicy("order_items_select_admin", { for: "select", to: authenticatedRole, using: isAdmin }),
  ],
);

// ─── settlements: 월별 정산 완료 기록 (스냅숏) ─────────────────────────────────
// 행이 있으면 "정산 완료"(그 시점 숫자로 고정), 없으면 "정산 예정"(주문 항목에서 실시간 계산).
// 쓰기는 관리자 함수(admin_settle_month)만 — 사용자에게 INSERT/UPDATE 권한이 없다
export const settlements = pgTable(
  "settlements",
  {
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict" }),
    month: date("month").notNull(), // 그 달 1일 (이용일 기준 월)
    itemCount: integer("item_count").notNull(),
    revenue: integer("revenue").notNull(), // 결제액 - 환불액
    commission: integer("commission").notNull(),
    payout: integer("payout").notNull(), // revenue - commission (실제 송금 없음 — 포트폴리오 모의)
    settledAt: timestamp("settled_at", { withTimezone: true }).notNull().defaultNow(),
    settledBy: uuid("settled_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    primaryKey({ name: "settlements_pkey", columns: [t.partnerId, t.month] }),
    check("settlements_month_first_day", sql`extract(day from ${t.month}) = 1`),
    check("settlements_amounts", sql`${t.payout} = ${t.revenue} - ${t.commission}`),
    pgPolicy("settlements_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.partnerId} = ${myPartnerId}`,
    }),
    pgPolicy("settlements_select_admin", { for: "select", to: authenticatedRole, using: isAdmin }),
  ],
);

// ─── order_item_options: 주문 항목에 고른 옵션 — 구매 시점의 이름·단가를 복사해 둔다 ───────
export const orderItemOptions = pgTable(
  "order_item_options",
  {
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    // 옵션을 지워도 주문 기록은 남는다
    optionId: uuid("option_id").references(() => productOptions.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    unit: optionUnitEnum("unit").notNull(),
    unitPrice: integer("unit_price").notNull(),
    qty: smallint("qty").notNull(), // 건당 = 1, 1인당 = 인원 수
    amount: integer("amount").notNull(),
  },
  (t) => [
    primaryKey({ name: "order_item_options_pkey", columns: [t.orderItemId, t.name] }),
    // 주문 항목을 볼 수 있는 사람(본인·담당 파트너·관리자)만 — order_items의 RLS를 그대로 따른다
    pgPolicy("order_item_options_select_visible", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.order_items oi where oi.id = ${t.orderItemId})`,
    }),
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

// ─── likes: 찜 (사용자 × 상품, 폴더는 0~1개 — 사용자 확정) ─────────────────
export const likes = pgTable(
  "likes",
  {
    userId: uuid("user_id")
      .notNull()
      .default(sql`auth.uid()`)
      .references(() => profiles.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // 폴더를 지우면 찜은 남기고 "폴더 없음"으로 돌린다
    folderId: uuid("folder_id").references(() => likeFolders.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    // 같은 상품을 두 번 찜할 수 없다
    primaryKey({ name: "likes_pkey", columns: [t.userId, t.productId] }),
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
    // 주문(place_order)이 자동으로 만든 여행이면 그 주문 id. 주문을 취소해 여행이 비면 함께 지운다.
    // 사용자는 이 컬럼을 쓸 수 없다(GRANT 없음)
    createdByOrderId: uuid("created_by_order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
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

// 일정 항목에는 user_id가 없으므로 "상위 여행이 본인 것인지"로 소유권을 판단한다
const ownTrip = (tripId: AnyPgColumn) =>
  sql`exists (select 1 from public.trips tr where tr.id = ${tripId} and tr.user_id = ${authUid})`;

// ─── trip_items: 날짜별 일정 항목 (상품 연결 · 자유 장소 · 예약 자동 추가) ─────────
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
    // 상품과 연결되면 동선 지도에 좌표(만나는 장소)로 표시된다. 상품이 지워져도 항목은 남긴다
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    // 주문으로 자동 추가된 예약 항목. 사용자는 이 컬럼을 쓸 수 없다(GRANT 없음) — place_order만 채운다
    orderItemId: uuid("order_item_id")
      .unique("trip_items_order_item_unique")
      .references(() => orderItems.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    // 예약 유형 ⇔ 주문 항목 연결: 사용자가 직접 "예약" 항목을 만들거나 예약 항목의 유형을 바꿀 수 없다
    // (type::text로 비교: 같은 트랜잭션에서 추가한 enum 값을 바로 쓰면 Postgres가 거부한다)
    check(
      "trip_items_booking_link",
      sql`(${t.type}::text = 'booking') = (${t.orderItemId} is not null)`,
    ),
    check("trip_items_day_index", sql`${t.dayIndex} between 0 and 29`),
    check("trip_items_title_length", sql`char_length(${t.title}) between 1 and 60`),
    check("trip_items_note_length", sql`${t.note} is null or char_length(${t.note}) <= 200`),
    check(
      "trip_items_caution_length",
      sql`${t.caution} is null or char_length(${t.caution}) <= 60`,
    ),
    index("trip_items_order_idx").on(t.tripId, t.dayIndex, t.position),
    pgPolicy("trip_items_owner_all", {
      for: "all",
      to: authenticatedRole,
      using: ownTrip(t.tripId),
      withCheck: ownTrip(t.tripId),
    }),
    // 제한(restrictive) 정책은 위 정책과 AND로 묶인다: 예약 항목은 일정에서 직접 지울 수 없다.
    // 주문을 취소하면 cancel_order(security definer)가 함께 지운다
    pgPolicy("trip_items_delete_not_booking", {
      as: "restrictive",
      for: "delete",
      to: authenticatedRole,
      using: sql`${t.orderItemId} is null`,
    }),
  ],
);

// ─── reviews: 리뷰 (별점 + 텍스트 + 사진 1장, 상품당 1개, 구매 고객만 — 사용자 확정) ─────
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // profiles를 참조해야 supabase-js에서 reviews → profiles(display_name) 조인이 된다
    userId: uuid("user_id")
      .notNull()
      .default(sql`auth.uid()`)
      .references(() => profiles.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    content: text("content").notNull(),
    // Storage(review-photos 버킷)의 객체 경로: "{user_id}/{파일명}"
    photoPath: text("photo_path"),
    // 관리자가 신고를 받아 숨김 처리한 시각 — 작성자·관리자에게만 보이고 평점 집계에서 빠진다
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
    check("reviews_content_length", sql`char_length(${t.content}) between 10 and 1000`),
    unique("reviews_user_product_unique").on(t.userId, t.productId),
    index("reviews_product_created_idx").on(t.productId, t.createdAt),
    publicRead("reviews_select_public"),
    // 제한(restrictive) 정책: 위 공개 읽기와 AND — 숨긴 리뷰는 작성자·관리자만 본다.
    // anon에게는 is_admin() 실행 권한이 없어서 역할별로 나눈다
    pgPolicy("reviews_hide_from_anon", {
      as: "restrictive",
      for: "select",
      to: anonRole,
      using: sql`${t.hiddenAt} is null`,
    }),
    pgPolicy("reviews_hide_from_others", {
      as: "restrictive",
      for: "select",
      to: authenticatedRole,
      using: sql`${t.hiddenAt} is null or ${t.userId} = ${authUid} or ${isAdmin}`,
    }),
    // 구매 인증: 이용일이 지난(취소되지 않은) 주문이 있어야 쓸 수 있다. 함수는 0005에 있다
    pgPolicy("reviews_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.userId} = ${authUid} and public.has_used_product(${t.productId})`,
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

// ─── review_reports: 리뷰 신고 → 관리자가 기각하거나 리뷰를 숨긴다 ──────────────────
export const reviewReports = pgTable(
  "review_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .default(sql`auth.uid()`)
      .references(() => profiles.id, { onDelete: "cascade" }),
    reason: reportReasonEnum("reason").notNull(),
    detail: text("detail"),
    status: reportStatusEnum("status").notNull().default("pending"),
    handledBy: uuid("handled_by").references(() => profiles.id, { onDelete: "set null" }),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("review_reports_detail", sql`${t.detail} is null or char_length(${t.detail}) <= 300`),
    // 같은 리뷰를 한 사람이 두 번 신고할 수 없다
    unique("review_reports_review_reporter_unique").on(t.reviewId, t.reporterId),
    index("review_reports_status_idx").on(t.status, t.createdAt),
    // 본인 리뷰 신고는 트리거(check_review_report)가 막는다
    pgPolicy("review_reports_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.reporterId} = ${authUid}`,
    }),
    pgPolicy("review_reports_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.reporterId} = ${authUid}`,
    }),
    pgPolicy("review_reports_select_admin", {
      for: "select",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ],
);

// ─── audit_logs: 누가 · 언제 · 무엇을 바꿨나 (주문 처리 이력, 관리자 조치) ─────────────────
// 쓰기는 트리거·관리자 함수(write_audit, 0021)만 — 사용자에게 INSERT 권한이 없다.
// 원본 행이 지워져도 기록은 남도록 entity_id·order_id에는 외래 키를 걸지 않는다.
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
    actorRole: text("actor_role").notNull(), // customer · partner · admin · system
    entity: text("entity").notNull(), // order · order_item · product · partner · settlement · review
    entityId: uuid("entity_id").notNull(),
    orderId: uuid("order_id"), // 주문 타임라인용 (주문·항목 기록만)
    action: text("action").notNull(), // 예: item.cancelled, product.suspend
    reasonCode: text("reason_code"),
    reason: text("reason"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "audit_logs_actor_role",
      sql`${t.actorRole} in ('customer', 'partner', 'admin', 'system')`,
    ),
    index("audit_logs_entity_idx").on(t.entity, t.entityId, t.createdAt),
    index("audit_logs_order_idx").on(t.orderId, t.createdAt),
    pgPolicy("audit_logs_select_admin", { for: "select", to: authenticatedRole, using: isAdmin }),
  ],
);

// ─── order_memos: 주문 CS 메모 (관리자 내부용) ─────────────────────────────────
// 고치거나 지울 수 없다 — 덧붙이기만 하므로 메모 자체가 처리 기록이 된다
export const orderMemos = pgTable(
  "order_memos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdBy: uuid("created_by")
      .default(sql`auth.uid()`)
      .references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    check("order_memos_body", sql`char_length(btrim(${t.body})) between 1 and 500`),
    index("order_memos_order_idx").on(t.orderId, t.createdAt),
    pgPolicy("order_memos_select_admin", { for: "select", to: authenticatedRole, using: isAdmin }),
    pgPolicy("order_memos_insert_admin", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${isAdmin} and ${t.createdBy} = ${authUid}`,
    }),
  ],
);

// ─── refund_adjustments: 관리자 환불 조정 기록 (규정 밖 추가 환불) ─────────────────
// 쓰기는 관리자 함수(admin_adjust_refund)만. 환불액은 늘리기만 한다
export const refundAdjustments = pgTable(
  "refund_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    beforeAmount: integer("before_amount").notNull(),
    afterAmount: integer("after_amount").notNull(),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    check("refund_adjustments_amounts", sql`${t.afterAmount} > ${t.beforeAmount}`),
    index("refund_adjustments_item_idx").on(t.orderItemId),
    pgPolicy("refund_adjustments_select_admin", {
      for: "select",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ],
);

// ─── settlement_adjustments: 정산 완료 뒤 생긴 변동 (조정 전표) ──────────────────────
// 정산 완료된 달 숫자는 그대로 두고, 차액을 조정한 시점의 달(항상 아직 정산 전)에 넣는다 (사용자 확정).
// 쓰기는 관리자 함수(admin_adjust_refund)만
export const settlementAdjustments = pgTable(
  "settlement_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "restrict" }),
    month: date("month").notNull(), // 반영할 달 1일
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    revenueDelta: integer("revenue_delta").notNull(), // 매출 변동 (환불 증액이면 음수)
    commissionDelta: integer("commission_delta").notNull(),
    source: text("source").notNull(), // refund_adjustment
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    check("settlement_adjustments_month_first_day", sql`extract(day from ${t.month}) = 1`),
    index("settlement_adjustments_partner_month_idx").on(t.partnerId, t.month),
    index("settlement_adjustments_item_idx").on(t.orderItemId),
    pgPolicy("settlement_adjustments_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.partnerId} = ${myPartnerId}`,
    }),
    pgPolicy("settlement_adjustments_select_admin", {
      for: "select",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ],
);
