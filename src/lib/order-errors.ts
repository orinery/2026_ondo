/**
 * DB 함수·트리거가 던지는 오류 코드 → 사용자에게 보여줄 문장.
 * 코드는 0005 마이그레이션의 `raise exception '<코드>'`와 같다 (Postgres 오류 메시지로 그대로 온다).
 */
const MESSAGES: Record<string, string> = {
  // 예약 규칙 (booking_error)
  product_not_found: "상품을 찾을 수 없어요.",
  unavailable: "지금은 판매하지 않는 상품이에요.",
  qty: "예약 인원을 확인해 주세요.",
  child_unavailable: "아동은 예약할 수 없는 상품이에요.",
  cutoff: "예약이 마감된 날짜예요. 다른 날짜를 골라 주세요.",
  too_far: "180일 이내의 날짜만 예약할 수 있어요.",
  closed_day: "운영하지 않는 요일이에요. 다른 날짜를 골라 주세요.",
  // 주문 (place_order)
  cart_changed: "장바구니가 바뀌었어요. 장바구니를 다시 확인해 주세요.",
  price_changed: "그 사이 가격이 바뀌었어요. 바뀐 금액을 확인한 뒤 다시 결제해 주세요.",
  policy_not_agreed: "취소 규정에 동의해 주세요.",
  // 취소 (cancel_order)
  not_found: "주문을 찾을 수 없어요.",
  already_cancelled: "이미 취소된 주문이에요.",
  not_cancellable: "이용일 당일·이후에는 취소할 수 없어요.",
  // 플래너 예약 항목
  booking_locked: "예약 항목은 날짜를 옮길 수 없어요. 날짜를 바꾸려면 예약을 취소해 주세요.",
  booking_out_of_range:
    "예약한 날짜가 여행 기간 밖으로 나가요. 예약 날짜를 포함하도록 기간을 정해 주세요.",
};

export const FALLBACK_MESSAGE = "잠시 후 다시 시도해 주세요.";

/** Postgres 오류 메시지에서 아는 코드를 찾는다. 모르는 오류는 null */
export function knownErrorCode(message: string | undefined) {
  if (!message) return null;
  const code = message.trim();
  return code in MESSAGES ? code : null;
}

export function errorMessage(code: string | null | undefined) {
  return (code && MESSAGES[code]) || FALLBACK_MESSAGE;
}
