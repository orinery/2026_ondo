import type { SeasonSlug } from "@/lib/constants/taxonomy";

/**
 * 날짜 → 계절 (한국 기준: 3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울)
 * 서버 시간대(UTC)와 한국 시간이 다를 수 있어 Asia/Seoul 기준 월을 쓴다.
 */
export function seasonOf(date: Date): SeasonSlug {
  const month = Number(
    new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "Asia/Seoul" }).format(date),
  );
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

/** "October" 같은 영문 월 이름 (명세: "Picked for October") */
export function englishMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "Asia/Seoul" }).format(date);
}

export function seoulYear(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Asia/Seoul" }).format(date),
  );
}
