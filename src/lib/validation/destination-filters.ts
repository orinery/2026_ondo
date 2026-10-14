import { z } from "zod";

import {
  SEASON_VALUES,
  THEME_VALUES,
  type SeasonSlug,
  type ThemeSlug,
} from "@/lib/constants/taxonomy";

/**
 * 여행지 목록 필터 — URL 쿼리(?q=&country=&theme=&season=&page=)와 1:1로 대응한다.
 * URL은 누구나 고칠 수 있는 입력이므로 서버에서 항상 이 스키마로 검증한다.
 * 잘못된 값은 에러 대신 "필터 없음"으로 취급한다(.catch) — 오래된 링크도 페이지가 깨지지 않게.
 */
export type DestinationFilters = {
  q: string;
  country: string | null;
  theme: ThemeSlug | null;
  season: SeasonSlug | null;
};

export const EMPTY_FILTERS: DestinationFilters = {
  q: "",
  country: null,
  theme: null,
  season: null,
};

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v); // ?a=1&a=2 → "1"

const searchParamsSchema = z.object({
  q: z.preprocess(first, z.string().trim().max(50)).catch(""),
  country: z.preprocess(first, z.string().trim().min(1).max(30).nullable()).catch(null),
  theme: z.preprocess(first, z.enum(THEME_VALUES).nullable()).catch(null),
  season: z.preprocess(first, z.enum(SEASON_VALUES).nullable()).catch(null),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(20)).catch(1),
});

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseDestinationSearchParams(raw: RawSearchParams) {
  const parsed = searchParamsSchema.parse({
    q: raw.q ?? "",
    country: raw.country ?? null,
    theme: raw.theme ?? null,
    season: raw.season ?? null,
    page: raw.page ?? 1,
  });
  const { page, ...filters } = parsed;
  return { filters: filters satisfies DestinationFilters, page };
}

/** 필터 → URL 쿼리 문자열 (빈 값은 생략해 URL을 짧게 유지) */
export function toSearchParams(filters: DestinationFilters, page = 1): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.country) params.set("country", filters.country);
  if (filters.theme) params.set("theme", filters.theme);
  if (filters.season) params.set("season", filters.season);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}
