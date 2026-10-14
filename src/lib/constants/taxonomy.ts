/**
 * 여행지 분류(테마·계절)와 일정 항목 유형 상수.
 * URL 쿼리와 DB enum에는 영문 slug(sea, fall …)를, 화면에는 한글 label을 쓴다.
 * 예: /destinations?theme=sea&season=fall (명세 5.2 Behavior)
 *
 * *_VALUES 튜플은 DB enum(src/db/schema.ts)과 Zod 스키마가 함께 쓰는 "단일 출처"다.
 */

export const THEME_VALUES = ["sea", "city", "nature", "culture"] as const;
export const SEASON_VALUES = ["spring", "summer", "fall", "winter"] as const;
export const ITEM_TYPE_VALUES = ["move", "sight", "food"] as const;

export type ThemeSlug = (typeof THEME_VALUES)[number];
export type SeasonSlug = (typeof SEASON_VALUES)[number];
export type ItemTypeSlug = (typeof ITEM_TYPE_VALUES)[number];

const THEME_LABELS: Record<ThemeSlug, string> = {
  sea: "바다",
  city: "도시·예술",
  nature: "자연·트레킹",
  culture: "문화·미식",
};

const SEASON_LABELS: Record<SeasonSlug, string> = {
  spring: "봄",
  summer: "여름",
  fall: "가을",
  winter: "겨울",
};

const ITEM_TYPE_LABELS: Record<ItemTypeSlug, string> = {
  move: "이동",
  sight: "관광",
  food: "식사",
};

export const THEMES = THEME_VALUES.map((value) => ({ value, label: THEME_LABELS[value] }));
export const SEASONS = SEASON_VALUES.map((value) => ({ value, label: SEASON_LABELS[value] }));
export const ITEM_TYPES = ITEM_TYPE_VALUES.map((value) => ({
  value,
  label: ITEM_TYPE_LABELS[value],
}));

export const themeLabel = (slug: ThemeSlug) => THEME_LABELS[slug];
export const seasonLabel = (slug: SeasonSlug) => SEASON_LABELS[slug];
export const itemTypeLabel = (slug: ItemTypeSlug) => ITEM_TYPE_LABELS[slug];
