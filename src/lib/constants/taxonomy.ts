/**
 * 상품 분류(카테고리·테마), 계절, 주문 상태, 일정 항목 유형 상수.
 * URL 쿼리와 DB enum에는 영문 slug(tour, sea …)를, 화면에는 한글 label을 쓴다.
 * 예: /products?category=tour&theme=culture
 *
 * *_VALUES 튜플은 DB enum(src/db/schema.ts)과 Zod 스키마가 함께 쓰는 "단일 출처"다.
 * 계절(SEASON)은 DB에 저장하지 않고 메인 히어로 문구 선택에만 쓴다.
 */

export const CATEGORY_VALUES = ["tour", "ticket"] as const;
export const THEME_VALUES = ["sea", "city", "nature", "culture"] as const;
export const SEASON_VALUES = ["spring", "summer", "fall", "winter"] as const;
export const ORDER_STATUS_VALUES = ["paid", "cancelled"] as const;
// booking = 주문하면 DB 함수(place_order)가 일정에 자동으로 넣는 예약 항목. 사용자가 직접 고를 수 없다
export const ITEM_TYPE_VALUES = ["move", "sight", "food", "booking"] as const;
export const USER_ITEM_TYPE_VALUES = ["move", "sight", "food"] as const;

export type CategorySlug = (typeof CATEGORY_VALUES)[number];
export type ThemeSlug = (typeof THEME_VALUES)[number];
export type SeasonSlug = (typeof SEASON_VALUES)[number];
export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];
export type ItemTypeSlug = (typeof ITEM_TYPE_VALUES)[number];
export type UserItemTypeSlug = (typeof USER_ITEM_TYPE_VALUES)[number];

const CATEGORY_LABELS: Record<CategorySlug, string> = {
  tour: "투어·액티비티",
  ticket: "티켓·패스",
};

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
  booking: "예약",
};

export const CATEGORIES = CATEGORY_VALUES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));
export const THEMES = THEME_VALUES.map((value) => ({ value, label: THEME_LABELS[value] }));
export const SEASONS = SEASON_VALUES.map((value) => ({ value, label: SEASON_LABELS[value] }));
export const ITEM_TYPES = USER_ITEM_TYPE_VALUES.map((value) => ({
  value,
  label: ITEM_TYPE_LABELS[value],
}));

export const categoryLabel = (slug: CategorySlug) => CATEGORY_LABELS[slug];
export const themeLabel = (slug: ThemeSlug) => THEME_LABELS[slug];
export const seasonLabel = (slug: SeasonSlug) => SEASON_LABELS[slug];
export const itemTypeLabel = (slug: ItemTypeSlug) => ITEM_TYPE_LABELS[slug];
