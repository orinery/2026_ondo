"use client";

import { GripVerticalIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { itemTypeLabel } from "@/lib/constants/taxonomy";
import { cn } from "@/lib/utils";
import type { ItineraryDay, ItineraryItem, ItineraryItemType } from "@/types/itinerary";

/**
 * 타임라인 공용 부품 (Day 탭·dot·카드·빈 상태·스켈레톤)
 * 편집용(itinerary-timeline, dnd-kit 사용)과 읽기 전용(readonly-timeline)이 함께 쓴다.
 * 왜 파일을 나눴나: 읽기 전용 화면(상세 "추천 일정")이 드래그 라이브러리를 불러오지 않게 하기 위해 (8단계 성능 점검)
 */

/** Day 탭: 세그먼트 스타일 (명세 5.4) */
export function DayTabsList({ days }: { days: ItineraryDay[] }) {
  return (
    // 여행이 길면 Day 탭이 많아지므로 여러 줄로 감싼다.
    // 가로 스크롤로 하면 스크롤 영역이 키보드로 접근되지 않는 문제(axe: scrollable-region-focusable)가 생긴다
    <TabsList className="h-auto w-full flex-wrap justify-start rounded-md bg-muted p-1">
      {days.map((day) => (
        <TabsTrigger
          key={day.id}
          value={day.id}
          className="h-11 min-w-24 flex-1 shrink-0 rounded-sm text-sm font-medium text-muted-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm"
        >
          {day.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

/** 시간 칸 (미정이면 --:--) */
export function TimelineTime({ time }: { time: string | null }) {
  return (
    <span className="pt-3.5 text-sm font-semibold tabular-nums">
      {time ?? <span className="text-muted-foreground">--:--</span>}
    </span>
  );
}

export function TimelineDot({
  status,
  isLast,
}: {
  status: ItineraryItem["status"];
  isLast: boolean;
}) {
  return (
    <div aria-hidden className="flex flex-col items-center">
      <span
        className={cn(
          "mt-4.5 size-3 shrink-0 rounded-full",
          status === "upcoming" && "bg-input",
          status === "done" && "bg-stone-400 dark:bg-stone-600",
          // 진행 중: dot moss-600 + ring moss-100 (다크는 스케일 반전)
          status === "current" && "bg-primary ring-4 ring-moss-100 dark:ring-moss-900",
        )}
      />
      {!isLast && <span className="mt-1.5 w-px flex-1 bg-border" />}
    </div>
  );
}

// 유형 태그 색: 라이트는 스케일 100 배경 + 700 글자(명세), 다크는 900 배경 + 100 글자(사용자 확정)
const TYPE_TAG_CLASS: Record<ItineraryItemType, string> = {
  move: "bg-lake-100 text-lake-700 dark:bg-lake-900 dark:text-lake-100",
  sight: "bg-moss-100 text-moss-700 dark:bg-moss-900 dark:text-moss-100",
  food: "bg-glow-100 text-glow-700 dark:bg-glow-900 dark:text-glow-100",
};

export function TimelineCard({
  item,
  handle,
  onRemove,
  placeholder = false,
  dragging = false,
  previewHover = false,
  showActions = true,
  onEdit,
}: {
  item: ItineraryItem;
  showActions?: boolean;
  handle?: React.ReactNode;
  onRemove?: () => void;
  onEdit?: () => void;
  placeholder?: boolean;
  dragging?: boolean;
  previewHover?: boolean;
}) {
  const closed = Boolean(item.closedReason);
  const current = item.status === "current";

  return (
    <div
      data-preview={previewHover ? "hover" : undefined}
      className={cn(
        "group mb-3 flex items-start gap-2 rounded-md border bg-card py-3 pr-2 pl-3.5 transition-colors duration-fast",
        // hover: 보더 진하게 + 핸들·삭제 노출
        showActions &&
          "hover:border-stone-400 hover:bg-background dark:hover:border-stone-600 preview-hover:border-stone-400 preview-hover:bg-background",
        current && "border-[1.5px] border-primary bg-accent hover:border-primary hover:bg-accent",
        closed && "bg-muted",
        placeholder && "border-dashed border-input bg-transparent opacity-60",
        dragging && "-rotate-1 shadow-lg",
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-kr text-base font-semibold",
            current && "text-accent-foreground",
            closed && "text-muted-foreground line-through",
          )}
        >
          {onEdit ? (
            // 제목을 누르면 수정 창 (시간·메모·다른 날로 옮기기)
            <button
              type="button"
              onClick={onEdit}
              aria-label={`${item.title} 수정`}
              className="text-left underline-offset-3 hover:underline"
            >
              {item.title}
            </button>
          ) : (
            item.title
          )}
        </p>
        {item.note && (
          <p
            className={cn(
              "mt-0.5 text-sm text-muted-foreground",
              current && "text-accent-foreground",
            )}
          >
            {item.note}
          </p>
        )}
        {/* 배지 배경은 bg-card: 휴무 카드(bg-muted) 위에 warning 10%를 겹치면 대비가 4.5:1 아래로 떨어진다 (8단계 axe) */}
        {closed && (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-sm border border-warning/40 bg-card px-2 py-0.5 text-xs font-semibold text-warning">
            <TriangleAlertIcon aria-hidden className="size-3.5" />
            {item.closedReason}
          </p>
        )}
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
          TYPE_TAG_CLASS[item.type],
        )}
      >
        {itemTypeLabel(item.type)}
      </span>

      {/* 핸들·삭제: 마우스는 hover/포커스 시, 터치 기기는 항상 표시 (명세 5.4 hover) */}
      {showActions && (
        <div
          className={cn(
            "flex items-center opacity-0 transition-opacity duration-fast group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 preview-hover:opacity-100",
            dragging && "opacity-100",
          )}
        >
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`${item.title} 삭제`}
              className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2Icon aria-hidden className="size-4" />
            </button>
          )}
          {handle ?? (
            <span className="grid size-8 place-items-center text-muted-foreground">
              <GripVerticalIcon aria-hidden className="size-4" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Empty: "이 날은 아직 비어 있어요 · 찜에서 불러오기" (명세 5.4 empty) */
export function TimelineEmpty({ onImport }: { onImport?: () => void }) {
  return (
    <div className="ml-21 rounded-md border-[1.5px] border-dashed border-input p-5 text-center text-sm text-foreground">
      이 날은 아직 비어 있어요{onImport && " · "}
      {onImport && (
        <button
          type="button"
          onClick={onImport}
          className="font-semibold text-primary hover:underline"
        >
          찜에서 불러오기
        </button>
      )}
    </div>
  );
}

/** Loading (명세 5.4 loading) */
export function TimelineSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="일정 불러오는 중"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-13 w-full rounded-md" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-md border p-3.5">
          <Skeleton className="h-3.5 w-12 rounded-sm" />
          <Skeleton className="h-3.5 flex-1 rounded-sm" />
        </div>
      ))}
    </div>
  );
}
