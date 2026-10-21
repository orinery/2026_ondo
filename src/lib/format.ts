/**
 * 화면 표시용 포맷 함수 (원화 · 할인율 · 이용일)
 */

const krw = new Intl.NumberFormat("ko-KR");

/** 45000 → "45,000원" */
export function formatKrw(amount: number) {
  return `${krw.format(amount)}원`;
}

/** 정가 대비 할인율(%) — 정가가 없거나 더 싸지 않으면 null */
export function discountRate(price: number, listPrice: number | null) {
  if (!listPrice || listPrice <= price) return null;
  return Math.round((1 - price / listPrice) * 100);
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-10-25" → "10월 25일 (일)" */
export function formatUseDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

/** "2026-10-25" → "2026.10.25" */
export function formatDotDate(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${y}.${m}.${d}`;
}

// 서버(UTC)와 브라우저 어디서 그려도 같은 값이 나오도록 시간대를 한국으로 고정한다
const seoulDateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 타임스탬프(ISO) → "2026.10.21" 또는 "2026.10.21 14:30" (한국 시간) */
export function formatTimestamp(iso: string, withTime = false) {
  const parts = Object.fromEntries(
    seoulDateTime.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}.${parts.month}.${parts.day}`;
  return withTime ? `${date} ${parts.hour}:${parts.minute}` : date;
}
