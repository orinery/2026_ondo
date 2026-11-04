import type { Device, FunnelEvent } from "@/lib/funnel";

const SESSION_KEY = "yeoun:sid";
let memorySessionId: string | null = null;

/**
 * 방문 id — 탭마다 하나 (sessionStorage). 탭을 닫으면 사라지고, 회원 정보와 연결하지 않는다.
 * 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 페이지를 새로 열 때까지 메모리에 둔다.
 */
function sessionId() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    memorySessionId ??= crypto.randomUUID();
    return memorySessionId;
  }
}

/** 예약 위젯이 사이드 카드(1024 이상)인지 하단 시트(미만)인지로 나눈다 */
const device = (): Device =>
  window.matchMedia("(min-width: 1024px)").matches ? "desktop" : "mobile";

/**
 * 퍼널 이벤트 기록 (브라우저 전용).
 * sendBeacon은 응답을 기다리지 않고, 바로 다른 페이지로 이동해도(로그인으로 보내기 등) 전송이 이어진다.
 * 측정이 실패해도 사용자 동작에는 영향이 없어야 하므로 오류는 모두 무시한다.
 */
export function track(name: FunnelEvent, productId?: string) {
  try {
    const body = JSON.stringify({ name, sessionId: sessionId(), productId, device: device() });
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
  } catch {
    // 측정 실패는 무시
  }
}
