/**
 * 예약 규칙 (화면용) — DB 함수 public.booking_error(0005 마이그레이션)와 같은 규칙의 TypeScript 판.
 *
 * 왜 두 곳에 있나
 * - 화면: 달력에서 고를 수 없는 날짜를 미리 비활성화하고, 총액을 바로 보여주기 위해 (UX)
 * - DB: 장바구니 트리거와 place_order가 최종 판단 (보안). 화면 검사는 우회될 수 있으므로 믿지 않는다.
 * 규칙을 바꾸면 SQL 함수와 이 파일을 함께 고친다.
 */

export const MAX_DAYS_AHEAD = 180;

export type BookingRules = {
  adultPrice: number;
  childPrice: number | null; // null = 성인 전용
  operatingDays: number[]; // ISO 요일 1=월 … 7=일
  cutoffDays: number; // 이용일 N일 전까지 예약
  maxQty: number;
  unavailableReason: string | null;
};

export type BookingErrorCode =
  | "product_not_found"
  | "unavailable"
  | "qty"
  | "child_unavailable"
  | "cutoff"
  | "too_far"
  | "closed_day";

const DAY_MS = 24 * 60 * 60 * 1000;
const toUtc = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/** 두 날짜("YYYY-MM-DD") 사이 일수: b - a */
export function daysBetween(a: string, b: string) {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

export function addDays(ymd: string, days: number) {
  return new Date(toUtc(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

/** ISO 요일 (1=월 … 7=일) */
export function isoWeekday(ymd: string) {
  const day = new Date(toUtc(ymd)).getUTCDay(); // 0=일
  return day === 0 ? 7 : day;
}

/** 날짜만 놓고 예약 가능한지 (인원 제외) — 달력 비활성화에 쓴다 */
export function dateError(rules: BookingRules, useDate: string, today: string) {
  if (rules.unavailableReason) return "unavailable" as const;
  const days = daysBetween(today, useDate);
  if (days < rules.cutoffDays) return "cutoff" as const;
  if (days > MAX_DAYS_AHEAD) return "too_far" as const;
  if (!rules.operatingDays.includes(isoWeekday(useDate))) return "closed_day" as const;
  return null;
}

/** booking_error와 같은 순서로 검사한다 */
export function bookingError(
  rules: BookingRules,
  useDate: string,
  adult: number,
  child: number,
  today: string,
): BookingErrorCode | null {
  if (rules.unavailableReason) return "unavailable";
  if (adult < 0 || child < 0 || adult + child < 1 || adult + child > rules.maxQty) return "qty";
  if (child > 0 && rules.childPrice === null) return "child_unavailable";
  return dateError(rules, useDate, today);
}

/** 예약 가능한 가장 빠른 날짜 (없으면 null) — 위젯의 첫 달 표시에 쓴다 */
export function firstAvailableDate(rules: BookingRules, today: string) {
  for (let i = rules.cutoffDays; i <= MAX_DAYS_AHEAD; i += 1) {
    const date = addDays(today, i);
    if (!dateError(rules, date, today)) return date;
  }
  return null;
}

export function bookingTotal(
  rules: Pick<BookingRules, "adultPrice" | "childPrice">,
  adult: number,
  child: number,
) {
  return adult * rules.adultPrice + child * (rules.childPrice ?? 0);
}

const ERROR_LABELS: Record<BookingErrorCode, string> = {
  product_not_found: "판매 종료",
  unavailable: "판매 중지",
  qty: "인원 조건 변경",
  child_unavailable: "아동 예약 불가",
  cutoff: "예약 마감",
  too_far: "예약 기간 밖",
  closed_day: "운영하지 않는 날",
};

/** 장바구니 배지용 짧은 사유 ("예약 마감") — 긴 안내 문장은 order-errors.ts */
export const bookingErrorLabel = (code: BookingErrorCode) => ERROR_LABELS[code];

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

/** [1,2,4,5,6,7] → "매일 (수요일 휴무)" / [1..7] → "매일" */
export function operatingDaysLabel(days: number[]) {
  if (days.length === 7) return "매일";
  const closed = [1, 2, 3, 4, 5, 6, 7].filter((d) => !days.includes(d));
  return `${closed.map((d) => WEEKDAY_LABELS[d - 1]).join("·")}요일 휴무`;
}

/** 예약 마감 안내: 0 → "당일까지 예약", 2 → "이용 2일 전까지 예약" */
export function cutoffLabel(cutoffDays: number) {
  return cutoffDays === 0 ? "당일까지 예약" : `이용 ${cutoffDays}일 전까지 예약`;
}
