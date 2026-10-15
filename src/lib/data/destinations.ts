import "server-only";

import { cache } from "react";

import type { SeasonSlug, ThemeSlug } from "@/lib/constants/taxonomy";
import { createClient } from "@/lib/supabase/server";
import type { DestinationFilters } from "@/lib/validation/destination-filters";
import type { Database } from "@/types/database";
import type { DestinationSummary, GalleryImage } from "@/types/destination";

/**
 * 여행지 조회 (Data Access Layer)
 * - 모든 조회는 supabase-js(사용자 JWT 또는 anon)로 해서 RLS가 적용된다.
 * - DB 행(snake_case) → 화면용 뷰 모델(camelCase)로 바꿔서 돌려준다. 컴포넌트는 DB 구조를 모른다.
 */

type DestinationRow = Database["public"]["Tables"]["destinations"]["Row"];

// 카드에 필요한 컬럼만 고른다 (설명 본문 등 큰 컬럼 제외)
const SUMMARY_COLUMNS =
  "id, slug, name, name_en, country, theme, season, image_url, image_alt, rating_avg, review_count, unavailable_reason";

type SummaryRow = Pick<
  DestinationRow,
  | "id"
  | "slug"
  | "name"
  | "name_en"
  | "country"
  | "theme"
  | "season"
  | "image_url"
  | "image_alt"
  | "rating_avg"
  | "review_count"
  | "unavailable_reason"
>;

function toSummary(row: SummaryRow): DestinationSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en,
    country: row.country,
    theme: row.theme,
    season: row.season,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    rating: Number(row.rating_avg),
    reviewCount: row.review_count,
    unavailableReason: row.unavailable_reason,
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

export async function getDestinations(filters: DestinationFilters, page = 1) {
  const supabase = await createClient();
  let query = supabase
    .from("destinations")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .order("rating_avg", { ascending: false })
    .order("name");

  const q = sanitizeSearch(filters.q);
  if (q) query = query.or(`name.ilike.%${q}%,name_en.ilike.%${q}%,country.ilike.%${q}%`);
  if (filters.country) query = query.eq("country", filters.country);
  if (filters.theme) query = query.eq("theme", filters.theme);
  // 계절 필터는 "추천 계절 배열에 포함되는가"로 판단한다 (대표 계절이 아님)
  if (filters.season) query = query.contains("best_seasons", [filters.season]);

  // "더 보기"는 페이지를 누적해서 보여준다: page=2 → 1~48번째
  const { data, count, error } = await query.range(0, page * PAGE_SIZE - 1);
  if (error) throw error;

  return { items: (data ?? []).map(toSummary), total: count ?? 0 };
}

/**
 * 테마 칩에 표시할 "이 테마를 고르면 몇 곳인지".
 * 테마를 제외한 나머지 조건만 적용해서 센다 → 0곳인 칩은 disabled (명세 5.2).
 */
export async function getThemeCounts(filters: DestinationFilters) {
  const supabase = await createClient();
  let query = supabase.from("destinations").select("theme");

  const q = sanitizeSearch(filters.q);
  if (q) query = query.or(`name.ilike.%${q}%,name_en.ilike.%${q}%,country.ilike.%${q}%`);
  if (filters.country) query = query.eq("country", filters.country);
  if (filters.season) query = query.contains("best_seasons", [filters.season]);

  const { data, error } = await query;
  if (error) throw error;

  const counts: Partial<Record<ThemeSlug, number>> = {};
  for (const { theme } of data ?? []) counts[theme] = (counts[theme] ?? 0) + 1;
  return counts;
}

/** 국가 Select 옵션 — 레이아웃과 페이지에서 함께 불러도 한 번만 조회한다 */
export const getCountries = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("destinations").select("country").order("country");
  if (error) throw error;
  return [...new Set((data ?? []).map((d) => d.country))];
});

/** 메인 "지금 떠나기 좋은 여행지" — 이번 계절을 추천 계절로 가진 곳 중 평점순 */
export async function getFeaturedDestinations(season: SeasonSlug, limit = 4) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("destinations")
    .select(SUMMARY_COLUMNS)
    .contains("best_seasons", [season])
    .is("unavailable_reason", null)
    .order("rating_avg", { ascending: false })
    .order("review_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toSummary);
}

/** 메인 테마 컬렉션 타일의 "여행지 n곳" */
export async function getThemeTotals() {
  return getThemeCounts({ q: "", country: null, theme: null, season: null });
}

export type DestinationDetail = DestinationSummary & {
  summary: string;
  description: string;
  bestSeasons: SeasonSlug[];
  latitude: number;
  longitude: number;
  flightInfo: string | null;
  timeDifference: string | null;
  currency: string | null;
  images: GalleryImage[];
  itinerary: {
    dayNumber: number;
    time: string | null;
    title: string;
    note: string | null;
    type: Database["public"]["Enums"]["itinerary_item_type"];
    caution: string | null;
  }[];
};

/** 상세 페이지 — 여행지 + 사진 + 추천 일정을 한 번의 요청으로 가져온다 (FK 관계로 중첩 조회) */
export const getDestinationBySlug = cache(
  async (slug: string): Promise<DestinationDetail | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("destinations")
      .select(
        `*,
       destination_images ( url, alt, position ),
       destination_itinerary_items ( day_number, position, time, title, note, type, caution )`,
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const images = [...data.destination_images]
      .sort((a, b) => a.position - b.position)
      .map(({ url, alt }) => ({ src: url, alt }));

    const itinerary = [...data.destination_itinerary_items]
      .sort((a, b) => a.day_number - b.day_number || a.position - b.position)
      .map((i) => ({
        dayNumber: i.day_number,
        // DB time 타입은 "07:30:00" → 화면에는 "07:30"
        time: i.time ? i.time.slice(0, 5) : null,
        title: i.title,
        note: i.note,
        type: i.type,
        caution: i.caution,
      }));

    return {
      ...toSummary(data),
      summary: data.summary,
      description: data.description,
      bestSeasons: data.best_seasons,
      latitude: data.latitude,
      longitude: data.longitude,
      flightInfo: data.flight_info,
      timeDifference: data.time_difference,
      currency: data.currency,
      images,
      itinerary,
    };
  },
);

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

/** 리뷰 목록 + 별점 분포 */
export async function getReviews(destinationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, user_id, rating, content, photo_path, created_at, profiles ( display_name, avatar_url )",
    )
    .eq("destination_id", destinationId)
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
