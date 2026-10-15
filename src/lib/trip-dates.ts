import type { ItineraryItemStatus } from "@/types/itinerary";

/**
 * 여행 날짜 계산.
 * DB의 date 컬럼은 "YYYY-MM-DD" 문자열로 온다. 시간대에 따라 하루가 밀리지 않도록 모든 계산을 UTC 자정 기준으로 한다.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/** 여행 일수 (시작일·종료일 포함). 11/2 ~ 11/4 → 3 */
export function tripDayCount(startDate: string, endDate: string): number {
  return Math.round((toUtc(endDate) - toUtc(startDate)) / DAY_MS) + 1;
}

/** dayIndex(0부터)의 날짜 → "YYYY-MM-DD" */
export function tripDayDate(startDate: string, dayIndex: number): string {
  return new Date(toUtc(startDate) + dayIndex * DAY_MS).toISOString().slice(0, 10);
}

/** "Day 1 · 11.2" (명세 5.4 Day 탭 라벨) */
export function tripDayLabel(startDate: string, dayIndex: number): string {
  const [, m, d] = tripDayDate(startDate, dayIndex).split("-").map(Number);
  return `Day ${dayIndex + 1} · ${m}.${d}`;
}

/** "2026.11.2 – 11.4" */
export function tripRangeLabel(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  return sy === ey ? `${sy}.${sm}.${sd} – ${em}.${ed}` : `${sy}.${sm}.${sd} – ${ey}.${em}.${ed}`;
}

/** 한국 시간 기준 오늘 날짜("YYYY-MM-DD")와 지금 시각("HH:MM") */
export function seoulNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    today: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * 타임라인 상태 계산 (명세 5.4: done / current / upcoming)
 * - 지난 날의 항목: done · 앞으로의 날: upcoming
 * - 오늘: 시작 시간이 지난 항목 중 마지막 하나가 current, 그 앞은 done
 * DB에 저장하지 않는 이유: 시간이 흐르면 저절로 바뀌는 값이라 저장하면 어긋난다.
 */
export function itemStatuses(
  dayDate: string,
  times: (string | null)[],
  now: { today: string; time: string },
): ItineraryItemStatus[] {
  if (dayDate < now.today) return times.map(() => "done");
  if (dayDate > now.today) return times.map(() => "upcoming");

  const started = times.map((t) => t !== null && t <= now.time);
  const currentIndex = started.lastIndexOf(true);
  return times.map((_, i) =>
    i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
  );
}
