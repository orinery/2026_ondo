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
  // 회차·재고·옵션 (0012)
  slot_not_found: "선택한 회차를 지금은 판매하지 않아요. 다른 회차를 골라 주세요.",
  slot_closed: "선택한 날짜의 회차가 마감됐어요. 다른 날짜나 회차를 골라 주세요.",
  sold_out: "남은 자리가 부족해요. 인원을 줄이거나 다른 날짜·회차를 골라 주세요.",
  option_invalid: "선택한 옵션을 지금은 고를 수 없어요. 옵션을 다시 골라 주세요.",
  capacity_below_booked: "이미 예약된 인원보다 적게 정원을 줄일 수 없어요.",
  // 주문 (place_order)
  cart_changed: "장바구니가 바뀌었어요. 장바구니를 다시 확인해 주세요.",
  price_changed: "그 사이 가격이 바뀌었어요. 바뀐 금액을 확인한 뒤 다시 결제해 주세요.",
  policy_not_agreed: "취소 규정에 동의해 주세요.",
  // 취소 (cancel_order)
  not_found: "주문을 찾을 수 없어요.",
  already_cancelled: "이미 취소된 주문이에요.",
  not_cancellable: "이용일 당일·이후이거나 이미 이용한 예약은 취소할 수 없어요.",
  // 플래너 예약 항목
  booking_locked: "예약 항목은 날짜를 옮길 수 없어요. 날짜를 바꾸려면 예약을 취소해 주세요.",
  booking_out_of_range:
    "예약한 날짜가 여행 기간 밖으로 나가요. 예약 날짜를 포함하도록 기간을 정해 주세요.",
  // 파트너 신청·관리자 (0010)
  forbidden: "이 작업을 할 권한이 없어요.",
  already_partner: "이미 파트너이거나 관리자인 계정이에요.",
  application_pending: "검토 중인 신청이 있어요. 결과가 나온 뒤에 다시 신청할 수 있어요.",
  not_pending: "이미 처리됐어요. 목록을 새로 고쳐 주세요.",
  invalid_reason: "거절 사유를 1~200자로 입력해 주세요.",
  invalid_status: "알 수 없는 상태예요.",
  // 파트너 센터 (0014)
  invalid_images:
    "사진은 1~8장, 이 사이트에 올린 사진만 쓸 수 있어요. 사진마다 설명을 적어 주세요.",
  invalid_slots: "회차는 1~6개, 같은 시간을 두 번 넣을 수 없어요.",
  invalid_options: "옵션은 10개까지, 같은 이름을 두 번 넣을 수 없어요.",
  invalid_itinerary: "진행 일정은 15개까지 넣을 수 있어요.",
  invalid_range: "오늘부터 180일 안의 기간을 골라 주세요.",
  voucher_not_found: "이 파트너의 바우처 코드가 아니에요. 코드를 다시 확인해 주세요.",
  already_used: "이미 사용 처리한 바우처예요.",
  voucher_cancelled: "취소되었거나 확정되지 않은 예약의 바우처예요.",
  not_use_date: "이용일 당일부터 사용 처리할 수 있어요.",
  // 정산 (0017)
  month_not_ended: "이용월이 끝난 달만 정산 완료로 처리할 수 있어요.",
  already_settled: "이미 정산 완료로 처리한 달이에요.",
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
