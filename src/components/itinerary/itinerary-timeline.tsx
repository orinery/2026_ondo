"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useId, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { itemTypeLabel } from "@/lib/constants/taxonomy";
import { cn } from "@/lib/utils";
import type { ItineraryDay, ItineraryItem, ItineraryItemType } from "@/types/itinerary";

type ItineraryTimelineProps = {
  days: ItineraryDay[];
  isLoading?: boolean;
  // 읽기 전용(상세 페이지 "추천 일정"): 드래그·삭제·추가 없이 보여주기만 한다
  readOnly?: boolean;
  // 아래 콜백은 7단계에서 Server Action과 연결한다. 2단계에서는 로컬 상태만 바뀐다.
  onReorder?: (dayId: string, orderedItemIds: string[]) => void;
  onRemove?: (dayId: string, itemId: string) => void;
  onAdd?: (dayId: string) => void;
  onImportFromLikes?: (dayId: string) => void;
  // 디자인 QA 전용: 특정 항목을 hover 상태로 고정
  previewHoverItemId?: string;
};

/**
 * 일정 타임라인 (명세 5.4 · Tabs + dnd-kit)
 * Day 탭 → 시간 · dot · 카드 3열 타임라인. 드래그 핸들로 같은 날 안에서 순서를 바꾼다.
 */
export function ItineraryTimeline({
  days: initialDays,
  isLoading = false,
  readOnly = false,
  onReorder,
  onRemove,
  onAdd,
  onImportFromLikes,
  previewHoverItemId,
}: ItineraryTimelineProps) {
  const [days, setDays] = useState(initialDays);
  const [activeDayId, setActiveDayId] = useState(initialDays[0]?.id ?? "");

  const updateItems = (dayId: string, updater: (items: ItineraryItem[]) => ItineraryItem[]) =>
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, items: updater(d.items) } : d)));

  if (isLoading) return <TimelineSkeleton />;

  return (
    <Tabs value={activeDayId} onValueChange={setActiveDayId} className="gap-6">
      {/* Day 탭: 세그먼트 스타일 (명세 5.4) */}
      <TabsList className="h-auto w-full rounded-md bg-muted p-1">
        {days.map((day) => (
          <TabsTrigger
            key={day.id}
            value={day.id}
            className="h-11 flex-1 rounded-sm text-sm font-medium text-muted-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            {day.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {days.map((day) => (
        <TabsContent key={day.id} value={day.id} className="flex flex-col">
          {day.items.length === 0 ? (
            <TimelineEmpty onImport={readOnly ? undefined : () => onImportFromLikes?.(day.id)} />
          ) : readOnly ? (
            <ol aria-label={`${day.label} 일정`}>
              {day.items.map((item, index) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[--spacing(13)_--spacing(5)_minmax(0,1fr)] gap-3"
                >
                  <span className="pt-3.5 text-sm font-semibold tabular-nums">
                    {item.time ?? <span className="text-muted-foreground">--:--</span>}
                  </span>
                  <TimelineDot status={item.status} isLast={index === day.items.length - 1} />
                  <TimelineCard item={item} showActions={false} />
                </li>
              ))}
            </ol>
          ) : (
            <SortableDay
              day={day}
              previewHoverItemId={previewHoverItemId}
              onReorder={(nextItems) => {
                updateItems(day.id, () => nextItems);
                onReorder?.(
                  day.id,
                  nextItems.map((i) => i.id),
                );
              }}
              onRemove={(itemId) => {
                updateItems(day.id, (items) => items.filter((i) => i.id !== itemId));
                onRemove?.(day.id, itemId);
              }}
            />
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => onAdd?.(day.id)}
              // 왼쪽 여백 = 시간(52) + dot(20) + gap(12) → 카드 시작선에 맞춘다
              className="mt-1 ml-21 flex h-11 items-center justify-center gap-1 rounded-md border-[1.5px] border-dashed border-input text-sm font-semibold text-primary transition-colors duration-fast hover:bg-accent"
            >
              <PlusIcon aria-hidden className="size-4" />
              장소 추가
            </button>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function SortableDay({
  day,
  previewHoverItemId,
  onReorder,
  onRemove,
}: {
  day: ItineraryDay;
  previewHoverItemId?: string;
  onReorder: (items: ItineraryItem[]) => void;
  onRemove: (itemId: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // dnd-kit은 접근성용 요소 ID를 전역 카운터로 만들어 서버·클라이언트 값이 달라진다(hydration 불일치).
  // React useId로 고정 ID를 넘겨 해결한다.
  const dndId = useId();
  const sensors = useSensors(
    // 4px 이상 움직여야 드래그로 판단 → 핸들을 단순 클릭할 때 오작동 방지
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // 키보드로도 정렬 가능 (Space로 잡고 ↑↓로 이동, Space로 놓기)
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: string | number) => day.items.find((i) => i.id === id)?.title ?? "항목";
  const positionOf = (id: string | number) => day.items.findIndex((i) => i.id === id) + 1;

  // 스크린리더 안내 문구를 한국어로 바꾼다
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${titleOf(active.id)}을(를) 잡았어요. 위아래 화살표로 옮기세요.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(active.id)}이(가) ${positionOf(over.id)}번째 위치에 있어요.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)}을(를) ${positionOf(over.id)}번째에 놓았어요.` : undefined,
    onDragCancel: ({ active }) => `${titleOf(active.id)} 이동을 취소했어요.`,
  };

  const handleDragStart = ({ active }: DragStartEvent) => setDraggingId(String(active.id));
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    if (!over || active.id === over.id) return;
    const from = day.items.findIndex((i) => i.id === active.id);
    const to = day.items.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(day.items, from, to));
  };

  const draggingItem = day.items.find((i) => i.id === draggingId);

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Space 키로 항목을 잡고, 위아래 화살표로 옮긴 뒤 Space 키로 놓으세요. Esc 키로 취소합니다.",
        },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <SortableContext items={day.items} strategy={verticalListSortingStrategy}>
        <ol aria-label={`${day.label} 일정`}>
          {day.items.map((item, index) => (
            <SortableTimelineRow
              key={item.id}
              item={item}
              isLast={index === day.items.length - 1}
              previewHover={previewHoverItemId === item.id}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </ol>
      </SortableContext>
      {/* 드래그 중인 항목의 복사본: shadow-lg + 살짝 기울임 (명세 5.4 dragging) */}
      <DragOverlay>
        {draggingItem ? <TimelineCard item={draggingItem} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableTimelineRow({
  item,
  isLast,
  previewHover,
  onRemove,
}: {
  item: ItineraryItem;
  isLast: boolean;
  previewHover: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="grid grid-cols-[--spacing(13)_--spacing(5)_minmax(0,1fr)] gap-3"
    >
      <span className="pt-3.5 text-sm font-semibold tabular-nums">
        {item.time ?? <span className="text-muted-foreground">--:--</span>}
      </span>
      <TimelineDot status={item.status} isLast={isLast} />
      <TimelineCard
        item={item}
        // 드래그 중에는 원래 자리를 점선으로 남긴다 (명세 5.4 dragging)
        placeholder={isDragging}
        previewHover={previewHover}
        onRemove={onRemove}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`${item.title} 순서 바꾸기`}
            className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-muted-foreground hover:bg-muted active:cursor-grabbing"
          >
            <GripVerticalIcon aria-hidden className="size-4" />
          </button>
        }
      />
    </li>
  );
}

function TimelineDot({ status, isLast }: { status: ItineraryItem["status"]; isLast: boolean }) {
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

function TimelineCard({
  item,
  handle,
  onRemove,
  placeholder = false,
  dragging = false,
  previewHover = false,
  showActions = true,
}: {
  item: ItineraryItem;
  showActions?: boolean;
  handle?: React.ReactNode;
  onRemove?: () => void;
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
          {item.title}
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
        {closed && (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-sm bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
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
function TimelineEmpty({ onImport }: { onImport?: () => void }) {
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
    <div aria-busy="true" aria-label="일정 불러오는 중" className="flex flex-col gap-6">
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
