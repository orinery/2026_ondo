import type { OrderStatus } from "@/lib/constants/taxonomy";

/**
 * 예약 내역에 보여주는 상태 — DB에는 paid / cancelled만 저장하고, 나머지는 이용일과 오늘 날짜로 계산한다.
 * 왜 저장하지 않나: "이용 완료"는 시간이 지나면 저절로 바뀌는 값이라 저장하면 어긋난다 (타임라인 상태와 같은 이유).
 *
 * - cancelled: 취소됨
 * - used: 결제 완료 + 모든 항목의 이용일이 지남
 * - upcoming: 결제 완료 + 아직 이용하지 않은 항목이 있음
 */
export type DisplayStatus = "upcoming" | "used" | "cancelled";

export const STATUS_FILTERS: { value: DisplayStatus | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "upcoming", label: "이용 예정" },
  { value: "used", label: "이용 완료" },
  { value: "cancelled", label: "취소" },
];

export const statusLabel = (s: DisplayStatus) =>
  ({ upcoming: "이용 예정", used: "이용 완료", cancelled: "취소" })[s];

export function displayStatus(
  status: OrderStatus,
  useDates: string[],
  today: string,
): DisplayStatus {
  if (status === "cancelled") return "cancelled";
  // "YYYY-MM-DD"는 문자열 비교가 곧 날짜 비교다
  return useDates.every((d) => d < today) ? "used" : "upcoming";
}

/**
 * 취소할 수 있는지 — DB cancel_order와 같은 규칙: 결제 완료 + 모든 항목의 이용일이 오늘 이후.
 * (화면에서 버튼을 숨기는 용도. 최종 판단은 DB 함수)
 */
export function isCancellable(status: OrderStatus, useDates: string[], today: string) {
  return status === "paid" && useDates.every((d) => d > today);
}
