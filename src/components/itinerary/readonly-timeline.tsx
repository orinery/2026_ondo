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
 * 읽기 전용 타임라인 — 상세 페이지 "추천 일정" (명세 5.4의 보기 전용 형태)
 * 편집용 ItineraryTimeline과 같은 부품을 쓰지만 드래그 라이브러리(dnd-kit)를 불러오지 않는다.
 */
export function ReadonlyTimeline({ days }: { days: ItineraryDay[] }) {
  return (
    <Tabs defaultValue={days[0]?.id} className="gap-6">
      <DayTabsList days={days} />
      {days.map((day) => (
        <TabsContent key={day.id} value={day.id} className="flex flex-col">
          {day.items.length === 0 ? (
            <TimelineEmpty />
          ) : (
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
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
