import { z } from "zod";

/**
 * 관리자 목록 필터 — URL 쿼리와 1:1로 대응한다 (상품 목록 필터와 같은 방식).
 * URL은 누구나 고칠 수 있는 입력이므로 서버에서 항상 이 스키마로 검증하고, 잘못된 값은 "필터 없음"으로 본다.
 */

export const ADMIN_PAGE_SIZE = 30;

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v); // ?a=1&a=2 → "1"
const text = (max: number) => z.preprocess(first, z.string().trim().max(max)).catch("");
const uuidOrNull = z.preprocess(first, z.uuid().nullable()).catch(null);
const dateOrNull = z.preprocess(first, z.iso.date().nullable()).catch(null);
const page = z.preprocess(first, z.coerce.number().int().min(1).max(500)).catch(1);

type RawSearchParams = Record<string, string | string[] | undefined>;

// ─── 주문 ─────────────────────────────────────────────────────────────────
export const ORDER_STATUS_FILTERS = [
  { value: "all", label: "전체" },
  { value: "pending", label: "확정 대기" },
  { value: "upcoming", label: "이용 예정" },
  { value: "used", label: "이용 완료" },
  { value: "partial", label: "부분 취소" },
  { value: "cancelled", label: "취소" },
] as const;
export type AdminOrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number]["value"];
const ORDER_STATUS_VALUES = ORDER_STATUS_FILTERS.map((s) => s.value) as [
  AdminOrderStatusFilter,
  ...AdminOrderStatusFilter[],
];

export type AdminOrderFilters = {
  q: string; // 주문번호·예약자 이름
  status: AdminOrderStatusFilter;
  partner: string | null;
  from: string | null; // 결제일 (YYYY-MM-DD, 한국 날짜)
  to: string | null;
};

const orderSchema = z.object({
  q: text(40),
  status: z.preprocess(first, z.enum(ORDER_STATUS_VALUES)).catch("all"),
  partner: uuidOrNull,
  from: dateOrNull,
  to: dateOrNull,
  page,
});

export function parseAdminOrderParams(raw: RawSearchParams) {
  const { page, ...filters } = orderSchema.parse({
    q: raw.q ?? "",
    status: raw.status ?? "all",
    partner: raw.partner ?? null,
    from: raw.from ?? null,
    to: raw.to ?? null,
    page: raw.page ?? 1,
  });
  return { filters: filters satisfies AdminOrderFilters, page };
}

export function orderSearchParams(filters: Partial<AdminOrderFilters>, page = 1): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.partner) params.set("partner", filters.partner);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

// ─── 상품 ─────────────────────────────────────────────────────────────────
// 상품 상태는 열 조합으로 정한다 (src/lib/data/partner-center.ts productState와 같은 우선순위)
export const PRODUCT_STATE_FILTERS = [
  { value: "all", label: "전체" },
  { value: "on_sale", label: "판매 중" },
  { value: "paused", label: "판매 일시 중단" },
  { value: "draft", label: "임시 저장" },
  { value: "suspended", label: "판매 중지(관리자)" },
] as const;
export type AdminProductState = (typeof PRODUCT_STATE_FILTERS)[number]["value"];
const PRODUCT_STATE_VALUES = PRODUCT_STATE_FILTERS.map((s) => s.value) as [
  AdminProductState,
  ...AdminProductState[],
];

export type AdminProductFilters = {
  q: string; // 상품명
  partner: string | null;
  city: string | null; // 도시 id
  state: AdminProductState;
};

const productSchema = z.object({
  q: text(50),
  partner: uuidOrNull,
  city: uuidOrNull,
  state: z.preprocess(first, z.enum(PRODUCT_STATE_VALUES)).catch("all"),
  page,
});

export function parseAdminProductParams(raw: RawSearchParams) {
  const { page, ...filters } = productSchema.parse({
    q: raw.q ?? "",
    partner: raw.partner ?? null,
    city: raw.city ?? null,
    state: raw.state ?? "all",
    page: raw.page ?? 1,
  });
  return { filters: filters satisfies AdminProductFilters, page };
}

export function productSearchParams(filters: Partial<AdminProductFilters>, page = 1): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.partner) params.set("partner", filters.partner);
  if (filters.city) params.set("city", filters.city);
  if (filters.state && filters.state !== "all") params.set("state", filters.state);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}
