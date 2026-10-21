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

// 계정 역할: 1계정 1역할. partner·admin은 콘솔(/partner, /admin)에 들어갈 수 있다
export const USER_ROLE_VALUES = ["customer", "partner", "admin"] as const;
export const PARTNER_STATUS_VALUES = ["active", "suspended"] as const;
export const APPLICATION_STATUS_VALUES = ["pending", "approved", "rejected"] as const;
// 예약 확정 방식: instant = 결제 즉시 확정, manual = 파트너가 확정·거절
export const CONFIRMATION_MODE_VALUES = ["instant", "manual"] as const;

// 주문 항목(예약) 상태. pending = 파트너 확정 대기, rejected·cancelled·expired = 전액/규정 환불로 끝난 상태
export const ORDER_ITEM_STATUS_VALUES = [
  "pending",
  "confirmed",
  "used",
  "rejected",
  "cancelled",
  "expired",
] as const;
// 추가 옵션 가격 단위: 예약 1건당 / 1인당
export const OPTION_UNIT_VALUES = ["per_booking", "per_person"] as const;

export type OrderItemStatus = (typeof ORDER_ITEM_STATUS_VALUES)[number];
export type OptionUnit = (typeof OPTION_UNIT_VALUES)[number];
export type UserRole = (typeof USER_ROLE_VALUES)[number];
export type PartnerStatus = (typeof PARTNER_STATUS_VALUES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUS_VALUES)[number];
export type ConfirmationMode = (typeof CONFIRMATION_MODE_VALUES)[number];

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

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "검토 중",
  approved: "승인",
  rejected: "거절",
};

const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  active: "활동 중",
  suspended: "이용 정지",
};

export const applicationStatusLabel = (s: ApplicationStatus) => APPLICATION_STATUS_LABELS[s];
export const partnerStatusLabel = (s: PartnerStatus) => PARTNER_STATUS_LABELS[s];

export const categoryLabel = (slug: CategorySlug) => CATEGORY_LABELS[slug];
export const themeLabel = (slug: ThemeSlug) => THEME_LABELS[slug];
export const seasonLabel = (slug: SeasonSlug) => SEASON_LABELS[slug];
export const itemTypeLabel = (slug: ItemTypeSlug) => ITEM_TYPE_LABELS[slug];
