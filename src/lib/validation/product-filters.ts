import { z } from "zod";

import {
  CATEGORY_VALUES,
  THEME_VALUES,
  type CategorySlug,
  type ThemeSlug,
} from "@/lib/constants/taxonomy";

/**
 * 상품 목록 필터 — URL 쿼리(?q=&city=&category=&theme=&date=&sort=&page=)와 1:1로 대응한다.
 * URL은 누구나 고칠 수 있는 입력이므로 서버에서 항상 이 스키마로 검증한다.
 * 잘못된 값은 에러 대신 "필터 없음"으로 취급한다(.catch) — 오래된 링크도 페이지가 깨지지 않게.
 */
export const SORT_VALUES = ["recommend", "price_asc", "price_desc", "rating", "reviews"] as const;
export type SortKey = (typeof SORT_VALUES)[number];

export const SORTS: { value: SortKey; label: string }[] = [
  { value: "recommend", label: "추천순" },
  { value: "price_asc", label: "낮은 가격순" },
  { value: "price_desc", label: "높은 가격순" },
  { value: "rating", label: "평점 높은순" },
  { value: "reviews", label: "리뷰 많은순" },
];

export type ProductFilters = {
  q: string;
  city: string | null; // 도시 slug
  category: CategorySlug | null;
  theme: ThemeSlug | null;
  date: string | null; // 이용일(YYYY-MM-DD) — 그날 예약 가능한 상품만
  sort: SortKey;
};

export const EMPTY_FILTERS: ProductFilters = {
  q: "",
  city: null,
  category: null,
  theme: null,
  date: null,
  sort: "recommend",
};

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v); // ?a=1&a=2 → "1"

const searchParamsSchema = z.object({
  q: z.preprocess(first, z.string().trim().max(50)).catch(""),
  city: z
    .preprocess(
      first,
      z
        .string()
        .regex(/^[a-z-]{1,30}$/)
        .nullable(),
    )
    .catch(null),
  category: z.preprocess(first, z.enum(CATEGORY_VALUES).nullable()).catch(null),
  theme: z.preprocess(first, z.enum(THEME_VALUES).nullable()).catch(null),
  date: z.preprocess(first, z.iso.date().nullable()).catch(null),
  sort: z.preprocess(first, z.enum(SORT_VALUES)).catch("recommend"),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(20)).catch(1),
});

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseProductSearchParams(raw: RawSearchParams) {
  const parsed = searchParamsSchema.parse({
    q: raw.q ?? "",
    city: raw.city ?? null,
    category: raw.category ?? null,
    theme: raw.theme ?? null,
    date: raw.date ?? null,
    sort: raw.sort ?? "recommend",
    page: raw.page ?? 1,
  });
  const { page, ...filters } = parsed;
  return { filters: filters satisfies ProductFilters, page };
}

/** 필터 → URL 쿼리 문자열 (빈 값·기본값은 생략해 URL을 짧게 유지) */
export function toSearchParams(filters: Partial<ProductFilters>, page = 1): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.city) params.set("city", filters.city);
  if (filters.category) params.set("category", filters.category);
  if (filters.theme) params.set("theme", filters.theme);
  if (filters.date) params.set("date", filters.date);
  if (filters.sort && filters.sort !== "recommend") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}
