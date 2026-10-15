"use client";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { ItineraryDay } from "@/types/itinerary";

import {
  DayTabsList,
  TimelineCard,
  TimelineDot,
  TimelineEmpty,
  TimelineTime,
} from "./timeline-parts";

/**
 * 읽기 전용 타임라인 — 상품 상세 "진행 일정" (명세 5.4의 보기 전용 형태)
 * 편집용 ItineraryTimeline과 같은 부품을 쓰지만 드래그 라이브러리(dnd-kit)를 불러오지 않는다.
 * 하루짜리 코스(투어 대부분)는 Day 탭 없이 목록만 보여준다.
 */
export function ReadonlyTimeline({ days }: { days: ItineraryDay[] }) {
  const [only] = days;
  if (days.length === 1 && only) return <DayItems day={only} />;

  return (
    <Tabs defaultValue={days[0]?.id} className="gap-6">
      <DayTabsList days={days} />
      {days.map((day) => (
        <TabsContent key={day.id} value={day.id} className="flex flex-col">
          <DayItems day={day} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function DayItems({ day }: { day: ItineraryDay }) {
  if (day.items.length === 0) return <TimelineEmpty />;
  return (
    <ol aria-label={`${day.label} 일정`}>
      {day.items.map((item, index) => (
        <li
          key={item.id}
          className="grid grid-cols-[--spacing(13)_--spacing(5)_minmax(0,1fr)] gap-3"
        >
          <TimelineTime time={item.time} />
          <TimelineDot status={item.status} isLast={index === day.items.length - 1} />
          <TimelineCard item={item} showActions={false} />
        </li>
      ))}
    </ol>
  );
}
