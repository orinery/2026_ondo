/**
 * 감사 로그(audit_logs) 화면 라벨 — 코드는 0021 트리거의 action·actor_role과 같다.
 */

export type AuditActorRole = "customer" | "partner" | "admin" | "system";

const ACTION_LABELS: Record<string, string> = {
  "order.paid": "결제",
  "item.pending": "확정 대기 등록",
  "item.confirmed": "예약 확정",
  "item.used": "이용 처리",
  "item.rejected": "예약 거절",
  "item.cancelled": "취소",
  "item.expired": "확정 기한 초과 · 자동 취소",
  "item.refund_adjusted": "환불 조정",
  "product.suspend": "판매 중지",
  "product.resume": "판매 재개",
  "partner.suspended": "이용 정지",
  "partner.active": "정지 해제",
  "settlement.settle": "정산 완료",
  "review.hide": "리뷰 숨김",
  "review.unhide": "리뷰 숨김 해제",
  "review.report_dismissed": "리뷰 신고 기각",
};

export function auditActionLabel(action: string, actorRole: AuditActorRole) {
  // 결제와 함께 확정된 항목은 "즉시 확정"
  if (action === "item.confirmed" && actorRole === "system") return "즉시 확정";
  return ACTION_LABELS[action] ?? action;
}

export function auditActorLabel(
  role: AuditActorRole,
  name: { actor?: string | null; partner?: string | null },
) {
  switch (role) {
    case "customer":
      return name.actor ? `고객 ${name.actor}` : "고객";
    case "partner":
      return name.partner ? `파트너 ${name.partner}` : "파트너";
    case "admin":
      return name.actor ? `관리자 ${name.actor}` : "관리자";
    case "system":
      return "시스템";
  }
}
