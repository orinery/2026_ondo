/**
 * 구매 퍼널 측정 (Quick Win Q4) — 이벤트 이름과 관리자 화면 라벨.
 * 목록은 DB CHECK funnel_events_name(0034)과 같다.
 */
export const FUNNEL_EVENTS = [
  "view_item", // 상품 상세를 열었다
  "start_booking", // 예약 위젯에서 날짜를 고르거나 하단 시트를 열었다
  "login_wall", // 담기·바로 구매를 눌렀는데 로그인이 필요해 로그인으로 보냈다
  "add_to_cart", // 담기 또는 바로 구매가 성공했다
  "begin_checkout", // 주문서를 열었다
  "purchase", // 주문 완료 화면을 열었다
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export const DEVICES = ["mobile", "desktop"] as const;
export type Device = (typeof DEVICES)[number];

/** 관리자 퍼널 표의 본 단계 (순서대로) */
export const FUNNEL_STEPS = [
  { key: "view_item", label: "상품 상세" },
  { key: "start_booking", label: "예약 시작" },
  { key: "add_to_cart", label: "담기 · 바로 구매" },
  { key: "begin_checkout", label: "주문서" },
  { key: "purchase", label: "결제 완료" },
] as const;
