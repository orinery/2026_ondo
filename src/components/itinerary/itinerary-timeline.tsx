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
import { GripVerticalIcon, PlusIcon } from "lucide-react";
import { useId, useState } from "react";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { ItineraryDay, ItineraryItem } from "@/types/itinerary";

import {
  DayTabsList,
  TimelineCard,
  TimelineDot,
  TimelineEmpty,
  TimelineSkeleton,
  TimelineTime,
} from "./timeline-parts";

// 기존 import 경로 호환 (상세 loading.tsx, /dev/components)
export { TimelineSkeleton } from "./timeline-parts";

type ItineraryTimelineProps = {
  days: ItineraryDay[];
  isLoading?: boolean;
  // 선택한 Day를 부모가 관리할 때 (일정 플래너: 동선 지도가 같은 Day를 보여줘야 함)
  activeDayId?: string;
  onActiveDayChange?: (dayId: string) => void;
  // 아래 콜백이 없으면 로컬 상태만 바뀐다 (/dev/components 데모)
  onReorder?: (dayId: string, orderedItemIds: string[]) => void;
  onEditItem?: (dayId: string, itemId: string) => void;
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
  activeDayId: controlledDayId,
  onActiveDayChange,
  onReorder,
  onEditItem,
  onRemove,
  onAdd,
  onImportFromLikes,
  previewHoverItemId,
}: ItineraryTimelineProps) {
  const [days, setDays] = useState(initialDays);
  const [prevDays, setPrevDays] = useState(initialDays);
  const [localDayId, setLocalDayId] = useState(initialDays[0]?.id ?? "");
  const activeDayId = controlledDayId ?? localDayId;
  const setActiveDayId = (id: string) => {
    setLocalDayId(id);
    onActiveDayChange?.(id);
  };

  // 서버에서 새 데이터가 오면(저장 후 다시 그리기) 화면 상태를 맞춘다.
  // 드래그 직후에는 로컬 상태로 먼저 바꿔 두고(즉시 반영), 서버 응답이 오면 여기서 확정값으로 덮어쓴다.
  if (initialDays !== prevDays) {
    setPrevDays(initialDays);
    setDays(initialDays);
  }

  const updateItems = (dayId: string, updater: (items: ItineraryItem[]) => ItineraryItem[]) =>
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, items: updater(d.items) } : d)));

  if (isLoading) return <TimelineSkeleton />;

  return (
    <Tabs value={activeDayId} onValueChange={setActiveDayId} className="gap-6">
      <DayTabsList days={days} />

      {days.map((day) => (
        <TabsContent key={day.id} value={day.id} className="flex flex-col">
          {day.items.length === 0 ? (
            <TimelineEmpty onImport={() => onImportFromLikes?.(day.id)} />
          ) : (
            <SortableDay
              day={day}
              previewHoverItemId={previewHoverItemId}
              onEdit={onEditItem ? (itemId) => onEditItem(day.id, itemId) : undefined}
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
          <button
            type="button"
            onClick={() => onAdd?.(day.id)}
            // 왼쪽 여백 = 시간(52) + dot(20) + gap(12) → 카드 시작선에 맞춘다
            className="mt-1 ml-21 flex h-11 items-center justify-center gap-1 rounded-md border-[1.5px] border-dashed border-input text-sm font-semibold text-primary transition-colors duration-fast hover:bg-accent"
          >
            <PlusIcon aria-hidden className="size-4" />
            장소 추가
          </button>
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
  onEdit,
}: {
  day: ItineraryDay;
  previewHoverItemId?: string;
  onReorder: (items: ItineraryItem[]) => void;
  onRemove: (itemId: string) => void;
  onEdit?: (itemId: string) => void;
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
              onEdit={onEdit ? () => onEdit(item.id) : undefined}
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
  onEdit,
}: {
  item: ItineraryItem;
  isLast: boolean;
  previewHover: boolean;
  onRemove: () => void;
  onEdit?: () => void;
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
      <TimelineTime time={item.time} />
      <TimelineDot status={item.status} isLast={isLast} />
      <TimelineCard
        item={item}
        // 드래그 중에는 원래 자리를 점선으로 남긴다 (명세 5.4 dragging)
        placeholder={isDragging}
        previewHover={previewHover}
        onRemove={onRemove}
        onEdit={onEdit}
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
