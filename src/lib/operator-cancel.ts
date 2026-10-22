/**
 * 운영자 취소 사유 — 코드는 0024 admin_cancel_item과 같다.
 * 귀책 코드별 환불 (사용자 확정): 사업자·외부 사정은 전액, 고객 요청 대행은 취소 규정대로.
 */
export const OPERATOR_CANCEL_REASONS = [
  { code: "partner_operation", label: "파트너 사정", fullRefund: true },
  { code: "weather", label: "기상·천재지변", fullRefund: true },
  { code: "min_participants", label: "최소 인원 미달", fullRefund: true },
  { code: "customer_request", label: "고객 요청", fullRefund: false },
] as const;

export type OperatorCancelReason = (typeof OPERATOR_CANCEL_REASONS)[number]["code"];

export const OPERATOR_CANCEL_CODES = OPERATOR_CANCEL_REASONS.map((r) => r.code) as [
  OperatorCancelReason,
  ...OperatorCancelReason[],
];
