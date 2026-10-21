import "server-only";

import { cache } from "react";

import {
  addDays,
  daysBetween,
  isoWeekday,
  MAX_DAYS_AHEAD,
  type InventoryRow,
  type OptionRule,
  type SlotRule,
} from "@/lib/booking";
import type { ConfirmationMode, ThemeSlug, UserItemTypeSlug } from "@/lib/constants/taxonomy";
import { createClient } from "@/lib/supabase/server";
import { seoulNow } from "@/lib/trip-dates";
import type { ProductFilters, SortKey } from "@/lib/validation/product-filters";
import type { Database } from "@/types/database";
import type { CitySummary, GalleryImage, ProductSummary } from "@/types/product";

/**
 * 상품·도시 조회 (Data Access Layer)
 * - 모든 조회는 supabase-js(사용자 JWT 또는 anon)로 해서 RLS가 적용된다.
 * - 목록은 공개된(published_at 있는) 상품만: 파트너·관리자는 RLS로 임시 저장 상품도 읽을 수 있어서
 *   목록에 섞이지 않게 명시적으로 거른다.
 * - DB 행(snake_case) → 화면용 뷰 모델(camelCase)로 바꿔서 돌려준다. 컴포넌트는 DB 구조를 모른다.
 */

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type CityRow = Database["public"]["Tables"]["cities"]["Row"];

// 카드에 필요한 컬럼만 고른다 (설명 본문 등 큰 컬럼 제외). cities!inner: 도시 조건으로 거를 수 있게 내부 조인
const SUMMARY_COLUMNS =
  "id, slug, title, category, theme, image_url, image_alt, adult_price, list_adult_price, rating_avg, review_count, unavailable_reason, suspended_reason, cities!inner ( slug, name, name_en )";

type SummaryRow = Pick<
  ProductRow,
  | "id"
  | "slug"
  | "title"
  | "category"
  | "theme"
  | "image_url"
  | "image_alt"
  | "adult_price"
  | "list_adult_price"
  | "rating_avg"
  | "review_count"
  | "unavailable_reason"
  | "suspended_reason"
> & { cities: Pick<CityRow, "slug" | "name" | "name_en"> };

/** 판매하지 않는 이유 — 관리자 판매 중지가 파트너의 판매 중단보다 먼저 */
const unavailableOf = (row: Pick<ProductRow, "unavailable_reason" | "suspended_reason">) =>
  row.suspended_reason ? "판매가 중지된 상품이에요" : row.unavailable_reason;

function toSummary(row: SummaryRow): ProductSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    city: { slug: row.cities.slug, name: row.cities.name, nameEn: row.cities.name_en },
    category: row.category,
    theme: row.theme,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    adultPrice: row.adult_price,
    listAdultPrice: row.list_adult_price,
    rating: Number(row.rating_avg),
    reviewCount: row.review_count,
    unavailableReason: unavailableOf(row),
  };
}

/**
 * PostgREST의 or() 문법에서 특수한 의미를 갖는 문자(, ( ) 등)와 LIKE 와일드카드를 제거한다.
 * 왜: 사용자가 입력한 검색어가 쿼리 문법으로 해석되면 의도치 않은 조건이 추가될 수 있다.
 */
function sanitizeSearch(q: string) {
  return q.replace(/[,()%_*\\:"']/g, " ").trim();
}

export const PAGE_SIZE = 24; // 명세 4.2: 24개 단위 "더 보기"

/** 도시 목록 — 필터 Select·메인 타일·검색 팔레트가 함께 쓴다. 같은 요청에서는 한 번만 조회 */
export const getCities = cache(async (): Promise<CitySummary[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cities")
    .select("id, slug, name, name_en, summary, image_url, image_alt")
    .order("position");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    nameEn: c.name_en,
    summary: c.summary,
    imageUrl: c.image_url,
    imageAlt: c.image_alt,
  }));
});

type Filterable = Omit<ProductFilters, "sort">;

/** 검색어와 이름이 맞는 도시 id — "교토"로 검색하면 교토 상품 전체가 나오게 한다 */
async function searchCityIds(q: string) {
  const search = sanitizeSearch(q);
  if (!search) return [];
  const lower = search.toLowerCase();
  return (await getCities())
    .filter((c) => c.name.includes(search) || c.nameEn.toLowerCase().includes(lower))
    .map((c) => c.id);
}

/**
 * 공통 필터 적용. 쿼리 빌더 타입이 select 문자열마다 달라서 제네릭으로 받는다.
 * 동기 함수인 이유: 쿼리 빌더는 then이 있는 객체라 async 함수에서 돌려주면 await되는 순간 실행돼 버린다.
 * omit: 테마별 개수를 셀 때처럼 특정 조건을 빼고 적용하고 싶을 때
 */
function applyFilters<
  Q extends {
    or: (filters: string) => Q;
    eq: (column: string, value: string) => Q;
    contains: (column: string, value: number[]) => Q;
    lte: (column: string, value: number) => Q;
    is: (column: string, value: null) => Q;
    not: (column: string, operator: "is", value: null) => Q;
  },
>(query: Q, filters: Filterable, cityIds: string[], omit?: keyof Filterable): Q {
  let q = query.not("published_at", "is", null);
  const search = sanitizeSearch(filters.q);
  if (search && omit !== "q") {
    const conditions = [`title.ilike.%${search}%`, `summary.ilike.%${search}%`];
    if (cityIds.length > 0) conditions.push(`city_id.in.(${cityIds.join(",")})`);
    q = q.or(conditions.join(","));
  }
  if (filters.city && omit !== "city") q = q.eq("cities.slug", filters.city);
  if (filters.category && omit !== "category") q = q.eq("category", filters.category);
  if (filters.theme && omit !== "theme") q = q.eq("theme", filters.theme);
  if (filters.date && omit !== "date") {
    // 그날 예약 가능한 상품만: 운영 요일에 포함 + 마감 전 + 판매 중
    // (180일 제한은 날짜 선택 단계에서 막으므로 여기서는 생략)
    const daysLeft = daysBetween(seoulNow().today, filters.date);
    q = q
      .contains("operating_days", [isoWeekday(filters.date)])
      .lte("cutoff_days", Math.max(daysLeft, -1))
      .is("unavailable_reason", null);
  }
  return q;
}

const SORT_ORDER: Record<SortKey, { column: string; ascending: boolean }[]> = {
  recommend: [{ column: "recommend_rank", ascending: true }],
  price_asc: [{ column: "adult_price", ascending: true }],
  price_desc: [{ column: "adult_price", ascending: false }],
  rating: [
    { column: "rating_avg", ascending: false },
    { column: "review_count", ascending: false },
  ],
  reviews: [
    { column: "review_count", ascending: false },
    { column: "rating_avg", ascending: false },
  ],
};

export async function getProducts(filters: ProductFilters, page = 1) {
  const supabase = await createClient();
  let query = applyFilters(
    supabase.from("products").select(SUMMARY_COLUMNS, { count: "exact" }),
    filters,
    await searchCityIds(filters.q),
  );
  // 판매 중지 상품은 어떤 정렬이든 맨 뒤로
  query = query.order("unavailable_reason", { ascending: true, nullsFirst: true });
  for (const { column, ascending } of SORT_ORDER[filters.sort]) {
    query = query.order(column, { ascending, nullsFirst: false });
  }

  // "더 보기"는 페이지를 누적해서 보여준다: page=2 → 1~48번째
  const { data, count, error } = await query.order("title").range(0, page * PAGE_SIZE - 1);
  if (error) throw error;

  return { items: (data ?? []).map(toSummary), total: count ?? 0 };
}

/**
 * 테마 칩에 표시할 "이 테마를 고르면 몇 개인지".
 * 테마를 제외한 나머지 조건만 적용해서 센다 → 0개인 칩은 disabled (명세 5.2).
 */
export async function getThemeCounts(filters: Filterable) {
  const supabase = await createClient();
  const query = applyFilters(
    supabase.from("products").select("theme, cities!inner ( slug )"),
    filters,
    await searchCityIds(filters.q),
    "theme",
  );
  const { data, error } = await query;
  if (error) throw error;

  const counts: Partial<Record<ThemeSlug, number>> = {};
  for (const { theme } of data ?? []) counts[theme] = (counts[theme] ?? 0) + 1;
  return counts;
}

/** 메인 테마 컬렉션 타일의 "상품 n개" */
export async function getThemeTotals() {
  return getThemeCounts({ q: "", city: null, category: null, theme: null, date: null });
}

/** 메인 "지금 인기 있는 상품" — 판매 중인 상품을 추천 순위대로 */
export async function getFeaturedProducts(limit = 8) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(SUMMARY_COLUMNS)
    .not("published_at", "is", null)
    .is("unavailable_reason", null)
    .is("suspended_reason", null)
    .order("recommend_rank", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toSummary);
}

/** 검색 팔레트(⌘K)용 — 24개라 한 번에 가져온다 */
export async function getSearchItems() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, title, category, cities!inner ( name, name_en )")
    .not("published_at", "is", null)
    .order("recommend_rank", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    slug: p.slug,
    title: p.title,
    category: p.category,
    cityName: p.cities.name,
    cityNameEn: p.cities.name_en,
  }));
}

export type CancellationPolicy = {
  code: string;
  name: string;
  summary: string;
  tiers: { daysBefore: number; refundRate: number }[]; // daysBefore 내림차순
};

export type ProductDetail = ProductSummary & {
  summary: string;
  description: string;
  highlights: string[];
  childPrice: number | null;
  operatingDays: number[];
  cutoffDays: number;
  maxQty: number;
  startTime: string | null; // "08:00"
  durationText: string;
  includes: string[];
  excludes: string[];
  usageInfo: string[];
  meetingPoint: string;
  latitude: number;
  longitude: number;
  cancelPolicy: CancellationPolicy;
  confirmationMode: ConfirmationMode;
  slots: SlotRule[]; // 판매 중인 회차 (순서대로)
  options: OptionRule[]; // 판매 중인 추가 옵션
  images: GalleryImage[];
  itinerary: {
    time: string | null;
    title: string;
    note: string | null;
    type: UserItemTypeSlug | "booking";
    caution: string | null;
  }[];
};

/** 상세 — 상품 + 도시 + 사진 + 진행 일정 + 취소 규정을 한 번의 요청으로 (FK 관계로 중첩 조회) */
export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `*,
       cities!inner ( slug, name, name_en ),
       product_images ( url, alt, position ),
       product_itinerary_items ( position, time, title, note, type, caution ),
       product_slots ( id, start_time, capacity, active, position ),
       product_options ( id, name, price, unit, active, position ),
       cancellation_policies ( code, name, summary, cancellation_policy_tiers ( days_before, refund_rate ) )`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const images = [...data.product_images]
    .sort((a, b) => a.position - b.position)
    .map(({ url, alt }) => ({ src: url, alt }));

  const itinerary = [...data.product_itinerary_items]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({
      // DB time 타입은 "07:30:00" → 화면에는 "07:30"
      time: i.time ? i.time.slice(0, 5) : null,
      title: i.title,
      note: i.note,
      type: i.type,
      caution: i.caution,
    }));

  const policy = data.cancellation_policies;
  const slots = data.product_slots
    .filter((sl) => sl.active)
    .sort(
      (a, b) => a.position - b.position || (a.start_time ?? "").localeCompare(b.start_time ?? ""),
    )
    .map((sl) => ({
      id: sl.id,
      startTime: sl.start_time ? sl.start_time.slice(0, 5) : null,
      capacity: sl.capacity,
    }));
  const options = data.product_options
    .filter((o) => o.active)
    .sort((a, b) => a.position - b.position)
    .map((o) => ({ id: o.id, name: o.name, price: o.price, unit: o.unit }));
  const summary = toSummary(data);

  return {
    ...summary,
    // 임시 저장 상품은 소유 파트너·관리자만 볼 수 있다(RLS) — 미리 보기에서는 예약을 막는다
    unavailableReason: data.published_at ? summary.unavailableReason : "공개 전 상품이에요",
    summary: data.summary,
    description: data.description,
    highlights: data.highlights,
    childPrice: data.child_price,
    operatingDays: data.operating_days,
    cutoffDays: data.cutoff_days,
    maxQty: data.max_qty,
    startTime: data.start_time ? data.start_time.slice(0, 5) : null,
    durationText: data.duration_text,
    includes: data.includes,
    excludes: data.excludes,
    usageInfo: data.usage_info,
    meetingPoint: data.meeting_point,
    latitude: data.latitude,
    longitude: data.longitude,
    cancelPolicy: {
      code: policy.code,
      name: policy.name,
      summary: policy.summary,
      tiers: [...policy.cancellation_policy_tiers]
        .sort((a, b) => b.days_before - a.days_before)
        .map((t) => ({ daysBefore: t.days_before, refundRate: t.refund_rate })),
    },
    confirmationMode: data.confirmation_mode,
    slots,
    options,
    images,
    itinerary,
  };
});

/**
 * 예약 가능 기간(오늘 ~ 180일)의 날짜별 재고 — 덮어쓴 정원·가격·마감과 예약 인원.
 * 행은 덮어썼거나 예약이 있는 날짜에만 있어서 많지 않다. 없는 날짜는 회차 기본값.
 */
export async function getInventory(slotIds: string[], today: string): Promise<InventoryRow[]> {
  if (slotIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slot_inventory")
    .select("slot_id, use_date, capacity, closed, adult_price, child_price, booked")
    .in("slot_id", slotIds)
    .gte("use_date", today)
    .lte("use_date", addDays(today, MAX_DAYS_AHEAD));
  if (error) throw error;
  return data.map((i) => ({
    slotId: i.slot_id,
    useDate: i.use_date,
    capacity: i.capacity,
    closed: i.closed,
    adultPrice: i.adult_price,
    childPrice: i.child_price,
    booked: i.booked,
  }));
}

/** 같은 도시의 다른 상품 (상세 하단 "함께 보면 좋은 상품") */
export async function getRelatedProducts(product: Pick<ProductSummary, "id" | "city">, limit = 4) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(SUMMARY_COLUMNS)
    .eq("cities.slug", product.city.slug)
    .neq("id", product.id)
    .not("published_at", "is", null)
    .is("unavailable_reason", null)
    .is("suspended_reason", null)
    .order("recommend_rank", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toSummary);
}

export type ReviewItem = {
  id: string;
  userId: string; // "내 리뷰" 표시·수정 버튼 노출에 쓴다
  rating: number;
  content: string;
  photoUrl: string | null;
  photoPath: string | null;
  createdAt: string;
  author: { name: string; avatarUrl: string | null };
};

/** 리뷰 목록 + 별점 분포. 리뷰는 구매 고객만 쓸 수 있으므로(DB 정책) 모든 리뷰가 "구매 인증" 리뷰다 */
export async function getReviews(productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, user_id, rating, content, photo_path, created_at, profiles ( display_name, avatar_url )",
    )
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const items: ReviewItem[] = (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    rating: r.rating,
    content: r.content,
    photoUrl: r.photo_path
      ? supabase.storage.from("review-photos").getPublicUrl(r.photo_path).data.publicUrl
      : null,
    photoPath: r.photo_path,
    createdAt: r.created_at,
    author: {
      name: r.profiles?.display_name ?? "여행자",
      avatarUrl: r.profiles?.avatar_url ?? null,
    },
  }));

  // 5점 → 1점 순서의 개수
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: items.filter((r) => r.rating === star).length,
  }));

  return { items, distribution };
}

/** 로그인 사용자가 이 상품에 리뷰를 쓸 수 있는지 (DB의 has_used_product와 같은 판단) */
export async function canReviewProduct(productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_used_product", { p_product_id: productId });
  if (error) return false;
  return data;
}
