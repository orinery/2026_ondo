import type { OrderItemStatus, OrderStatus } from "@/lib/constants/taxonomy";

/**
 * 예약 상태 표시 — DB에는 주문 항목마다 상태(확정 대기·확정·이용 완료·거절·취소·만료)를 저장하고,
 * "이용 완료"처럼 시간이 지나면 저절로 바뀌는 값은 이용일과 오늘 날짜로 계산한다.
 * 왜 저장하지 않나: 이용일이 지나는 순간마다 DB를 바꿀 수 없어서 (타임라인 상태와 같은 이유).
 */

// ─── 주문 항목 ─────────────────────────────────────────────────────────
export type ItemDisplayStatus =
  | "pending" // 파트너 확정 대기
  | "processing" // 확정 기한이 지났는데 아직 자동 취소 전 (자동 만료 작업이 곧 처리)
  | "confirmed" // 예약 확정 (이용 전)
  | "used" // 이용 완료 (이용 처리됐거나 확정된 예약의 이용일이 지남)
  | "rejected"
  | "cancelled"
  | "expired";

export type ItemStatusInput = {
  status: OrderItemStatus;
  useDate: string;
  confirmDeadline: string | null;
};

export function itemDisplayStatus(
  item: ItemStatusInput,
  today: string,
  now: Date = new Date(),
): ItemDisplayStatus {
  switch (item.status) {
    case "pending":
      return item.confirmDeadline && new Date(item.confirmDeadline) < now
        ? "processing"
        : "pending";
    case "confirmed":
      // "YYYY-MM-DD"는 문자열 비교가 곧 날짜 비교다
      return item.useDate < today ? "used" : "confirmed";
    default:
      return item.status;
  }
}

export const itemStatusLabel = (s: ItemDisplayStatus) =>
  ({
    pending: "확정 대기",
    processing: "확정 처리 중",
    confirmed: "예약 확정",
    used: "이용 완료",
    rejected: "예약 거절",
    cancelled: "취소",
    expired: "기한 초과 취소",
  })[s];

/** 끝난 항목(환불로 정리됨) */
export const isClosedItem = (s: OrderItemStatus) =>
  s === "rejected" || s === "cancelled" || s === "expired";

/**
 * 항목을 취소할 수 있는지 — DB cancel_order_item과 같은 규칙: 확정 대기·확정 + 이용일이 오늘 이후.
 * (화면에서 버튼을 숨기는 용도. 최종 판단은 DB 함수)
 */
export const isItemCancellable = (
  item: Pick<ItemStatusInput, "status" | "useDate">,
  today: string,
) => (item.status === "pending" || item.status === "confirmed") && item.useDate > today;

// ─── 주문 ─────────────────────────────────────────────────────────────
/**
 * 주문 목록의 상태 (필터 기준):
 * - cancelled: 모든 항목이 끝남(취소·거절·만료)
 * - pending: 파트너 확정을 기다리는 항목이 있음
 * - upcoming: 확정됐고 아직 이용하지 않은 항목이 있음
 * - used: 남은 항목을 모두 이용함
 */
export type DisplayStatus = "pending" | "upcoming" | "used" | "cancelled";

export const STATUS_FILTERS: { value: DisplayStatus | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "pending", label: "확정 대기" },
  { value: "upcoming", label: "이용 예정" },
  { value: "used", label: "이용 완료" },
  { value: "cancelled", label: "취소" },
];

export const statusLabel = (s: DisplayStatus) =>
  ({ pending: "확정 대기", upcoming: "이용 예정", used: "이용 완료", cancelled: "취소" })[s];

export function displayStatus(
  status: OrderStatus,
  items: ItemStatusInput[],
  today: string,
): DisplayStatus {
  if (status === "cancelled") return "cancelled";
  const shown = items.map((i) => itemDisplayStatus(i, today));
  if (shown.some((s) => s === "pending" || s === "processing")) return "pending";
  if (shown.includes("confirmed")) return "upcoming";
  return "used";
}

/** 주문 전체 취소 버튼: 취소할 수 있는 항목이 하나라도 있으면 (DB cancel_order가 그 항목들만 취소) */
export function isCancellable(items: Pick<ItemStatusInput, "status" | "useDate">[], today: string) {
  return items.some((i) => isItemCancellable(i, today));
}
