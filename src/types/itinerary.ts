import type { ItemTypeSlug } from "@/lib/constants/taxonomy";

/** 일정 항목 유형 — 명세 5.4 태그(이동/관광/식사) */
export type ItineraryItemType = ItemTypeSlug;

/**
 * 타임라인 상태 (명세 5.4)
 * - done: 지난 일정 (회색 dot)
 * - current: 진행 중 (moss dot + ring)
 * - upcoming: 기본
 * DB에 저장하지 않고, 여행 날짜와 현재 시각으로 화면에서 계산한다.
 */
export type ItineraryItemStatus = "done" | "current" | "upcoming";

export type ItineraryItem = {
  id: string;
  time: string | null; // "HH:MM", 미정이면 null
  title: string;
  note: string | null;
  type: ItineraryItemType;
  status: ItineraryItemStatus;
  // 주의 메모(예: "수요일 휴무"). 값이 있으면 disabled 상태 + 경고 배지로 표시한다
  closedReason?: string | null;
};

export type ItineraryDay = {
  id: string;
  label: string; // "Day 1 · 11.2"
  items: ItineraryItem[];
};
