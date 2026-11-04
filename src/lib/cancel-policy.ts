/**
 * 취소 규정 요약 (Quick Win Q2) — 상세 예약 위젯·상품 카드에서 "무료 취소" 여부를 한 줄로 보여 준다.
 * 구간 규칙은 DB refund_quote와 같다: 남은 일수 이하인 구간 중 days_before가 가장 큰 것을 적용.
 */
export type PolicyTier = { daysBefore: number; refundRate: number };

/**
 * 전액 환불을 받을 수 있는 가장 늦은 시점(이용 N일 전). 전액 환불 구간이 없으면 null.
 * 예: [7일 100%, 3일 50%, 1일 20%] → 7 · [1일 100%] → 1 · [0일 0%] → null
 */
export function freeCancelDays(tiers: PolicyTier[]): number | null {
  const full = tiers.filter((t) => t.refundRate === 100).map((t) => t.daysBefore);
  return full.length === 0 ? null : Math.min(...full);
}

/** 무료 취소 문구 — 0일 구간(결제 후 언제든 전액)은 기간 없이 */
export const freeCancelLabel = (days: number) =>
  days === 0 ? "무료 취소" : `이용 ${days}일 전까지 무료 취소`;

/** 위젯용 한 줄 요약: 무료 취소 / 수수료 있음 / 환불 불가 */
export function cancelSummary(tiers: PolicyTier[]) {
  const free = freeCancelDays(tiers);
  if (free !== null) return { kind: "free" as const, label: freeCancelLabel(free) };
  if (tiers.some((t) => t.refundRate > 0))
    return { kind: "partial" as const, label: "취소하면 수수료가 있어요" };
  return { kind: "none" as const, label: "결제 후에는 환불되지 않아요" };
}
