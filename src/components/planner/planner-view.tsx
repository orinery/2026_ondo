"use client";

import { CalendarPlusIcon, MapIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { deleteTrip, removeTripItem, reorderTripItems } from "@/actions/trips";
import { ItineraryTimeline } from "@/components/itinerary/itinerary-timeline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { TripDetail, TripSummary } from "@/lib/data/trips";
import {
  itemStatuses,
  tripDayCount,
  tripDayDate,
  tripDayLabel,
  tripRangeLabel,
} from "@/lib/trip-dates";
import { cn } from "@/lib/utils";
import type { ItineraryDay } from "@/types/itinerary";

import { ImportLikesDialog, type LikeOption } from "./import-likes-dialog";
import { RouteMap, type RoutePoint } from "./route-map";
import { TripFormDialog } from "./trip-form-dialog";
import { TripItemDialog, type TripItemDialogState } from "./trip-item-dialog";

type PlannerViewProps = {
  trips: TripSummary[];
  trip: TripDetail | null; // 선택한 여행 (없으면 빈 상태)
  likes: LikeOption[]; // "찜에서 불러오기" 후보
  now: { today: string; time: string }; // 서버에서 계산한 한국 시간 (hydration 불일치 방지)
};

const NEW_TRIP = "__new__";
const dayId = (index: number) => `day-${index}`;
const dayIndexOf = (id: string) => Number(id.replace("day-", ""));

/**
 * 일정 플래너 (명세 4.4)
 * - 1280: 여행 목록 3col · Day 타임라인 5col(드래그 정렬) · 동선 지도 4col
 * - 768~1279: 여행 선택 드롭다운 + 타임라인, 지도는 토글 패널
 * - 767 이하: 같은 구성, 지도는 풀스크린 시트
 */
export function PlannerView({ trips, trip, likes, now }: PlannerViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeDay, setActiveDay] = useState(dayId(0));
  const [tripForm, setTripForm] = useState<{ open: boolean; trip: TripSummary | null }>({
    open: false,
    trip: null,
  });
  const [itemDialog, setItemDialog] = useState<TripItemDialogState>(null);
  const [importDay, setImportDay] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mapOpen, setMapOpen] = useState(false); // 768~1279 토글 패널
  // 삭제·순서 저장이 거부됐을 때의 안내 (예: 예약 항목은 일정에서 직접 지울 수 없음)
  const [notice, setNotice] = useState<string | null>(null);

  // 다른 여행을 고르면 Day 1로 돌아간다
  const [prevTripId, setPrevTripId] = useState(trip?.id);
  if (trip?.id !== prevTripId) {
    setPrevTripId(trip?.id);
    setActiveDay(dayId(0));
    setNotice(null);
  }

  // DB 항목 → 타임라인 형태(Day별). 서버 데이터가 바뀔 때만 다시 계산해 타임라인이 불필요하게 초기화되지 않게 한다
  const days = useMemo<ItineraryDay[]>(() => {
    if (!trip) return [];
    const count = tripDayCount(trip.startDate, trip.endDate);
    return Array.from({ length: count }, (_, index) => {
      const items = trip.items.filter((i) => i.dayIndex === index);
      const statuses = itemStatuses(
        tripDayDate(trip.startDate, index),
        items.map((i) => i.time),
        now,
      );
      return {
        id: dayId(index),
        label: tripDayLabel(trip.startDate, index),
        items: items.map((i, k) => ({
          id: i.id,
          time: i.time,
          title: i.title,
          note: i.note,
          type: i.type,
          status: statuses[k] ?? "upcoming",
          closedReason: i.caution,
          bookingHref: i.isBooking && i.orderNo ? `/my/orders/${i.orderNo}` : null,
          bookingPending: i.bookingPending,
        })),
      };
    });
  }, [trip, now]);

  const activeIndex = dayIndexOf(activeDay);
  const points = useMemo<RoutePoint[]>(
    () =>
      (trip?.items ?? [])
        .filter((i) => i.dayIndex === activeIndex && i.product)
        .flatMap((i) =>
          i.product
            ? [
                {
                  id: i.id,
                  label: i.title,
                  latitude: i.product.latitude,
                  longitude: i.product.longitude,
                },
              ]
            : [],
        ),
    [trip, activeIndex],
  );

  const selectTrip = (id: string) => {
    if (id === NEW_TRIP) return setTripForm({ open: true, trip: null });
    router.push(`/my?tab=planner&trip=${id}`, { scroll: false });
  };

  // ── 여행이 하나도 없을 때 (empty)
  if (trips.length === 0 || !trip) {
    return (
      <>
        <div className="flex flex-col items-center gap-3 rounded-xl border-[1.5px] border-dashed border-input px-6 py-16 text-center">
          <CalendarPlusIcon aria-hidden className="size-7 text-muted-foreground" />
          <p className="font-kr text-xl font-semibold">아직 만든 여행이 없어요</p>
          <p className="text-muted-foreground">
            여행 날짜를 정하고, 날짜별로 가고 싶은 곳을 담아 보세요.
          </p>
          <Button
            onClick={() => setTripForm({ open: true, trip: null })}
            className="mt-2 h-11 rounded-md px-5"
          >
            <PlusIcon aria-hidden className="size-4" />새 여행 만들기
          </Button>
        </div>
        <TripFormDialog
          open={tripForm.open}
          trip={tripForm.trip}
          onOpenChange={(open) => setTripForm((s) => ({ ...s, open }))}
        />
      </>
    );
  }

  const dayLabels = days.map((d) => d.label);

  return (
    <div className="grid gap-8 xl:grid-cols-12">
      {/* ── 1280: 여행 목록 3col ── */}
      <aside aria-label="내 여행 목록" className="hidden xl:col-span-3 xl:block">
        <div className="flex flex-col gap-2">
          {trips.map((t) => (
            <Link
              key={t.id}
              href={`/my?tab=planner&trip=${t.id}`}
              scroll={false}
              aria-current={t.id === trip.id ? "page" : undefined}
              className={cn(
                "rounded-md border p-4 transition-colors duration-fast",
                t.id === trip.id ? "border-primary bg-accent" : "bg-card hover:bg-muted",
              )}
            >
              <p className="truncate font-semibold">{t.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                {tripRangeLabel(t.startDate, t.endDate)} · 일정 {t.itemCount}개
              </p>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setTripForm({ open: true, trip: null })}
            className="flex h-12 items-center justify-center gap-1 rounded-md border-[1.5px] border-dashed border-input text-sm font-semibold text-primary hover:bg-accent"
          >
            <PlusIcon aria-hidden className="size-4" />새 여행
          </button>
        </div>
      </aside>

      {/* ── 타임라인 5col ── */}
      <section aria-labelledby="trip-title" className="flex min-w-0 flex-col gap-5 xl:col-span-5">
        {/* 1279 이하: 여행 선택 드롭다운 (사용자 확정) */}
        <Select value={trip.id} onValueChange={selectTrip}>
          <SelectTrigger aria-label="여행 선택" className="h-12! w-full text-base xl:hidden">
            <SelectValue>{trip.title}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {trips.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title} · {tripRangeLabel(t.startDate, t.endDate)}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={NEW_TRIP}>+ 새 여행 만들기</SelectItem>
          </SelectContent>
        </Select>

        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="trip-title" className="truncate font-kr text-2xl font-semibold">
              {trip.title}
            </h2>
            <p className="text-sm text-muted-foreground tabular-nums">
              {tripRangeLabel(trip.startDate, trip.endDate)} · {days.length}일
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/* 768~1279: 지도 토글 패널 */}
            <Button
              variant="outline"
              aria-expanded={mapOpen}
              onClick={() => setMapOpen((o) => !o)}
              className="hidden h-10 gap-1.5 rounded-md md:inline-flex xl:hidden"
            >
              <MapIcon aria-hidden className="size-4" />
              {mapOpen ? "지도 닫기" : "동선 지도"}
            </Button>
            {/* 767 이하: 풀스크린 시트 */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-10 gap-1.5 rounded-md md:hidden">
                  <MapIcon aria-hidden className="size-4" />
                  지도
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-dvh gap-0 p-0">
                <SheetTitle className="px-4 pt-4">{dayLabels[activeIndex]} 동선</SheetTitle>
                <SheetDescription className="sr-only">
                  선택한 날의 장소를 순서대로 보여주는 지도
                </SheetDescription>
                <RouteMap points={points} className="m-4 flex-1 rounded-lg" />
              </SheetContent>
            </Sheet>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`${trip.title} 여행 관리`}
                className="grid size-10 place-items-center rounded-md hover:bg-muted"
              >
                <MoreHorizontalIcon aria-hidden className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setTripForm({ open: true, trip })}>
                  여행 정보 수정
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                  여행 삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {mapOpen && <RouteMap points={points} className="hidden aspect-video md:block xl:hidden" />}

        {notice && (
          <p
            role="alert"
            className="rounded-md border border-destructive/50 bg-card p-3 text-sm text-destructive"
          >
            {notice}
          </p>
        )}

        <ItineraryTimeline
          days={days}
          activeDayId={activeDay}
          onActiveDayChange={setActiveDay}
          onReorder={(id, orderedIds) =>
            startTransition(async () => {
              const result = await reorderTripItems(trip.id, dayIndexOf(id), orderedIds);
              setNotice(result.ok ? null : (result.message ?? "순서를 저장하지 못했어요"));
            })
          }
          onRemove={(_, itemId) =>
            startTransition(async () => {
              const result = await removeTripItem(itemId);
              setNotice(result.ok ? null : (result.message ?? "삭제하지 못했어요"));
            })
          }
          onAdd={(id) => setItemDialog({ mode: "add", dayIndex: dayIndexOf(id) })}
          onEditItem={(_, itemId) => {
            const item = trip.items.find((i) => i.id === itemId);
            if (item) setItemDialog({ mode: "edit", item });
          }}
          onImportFromLikes={(id) => setImportDay(dayIndexOf(id))}
        />
        <button
          type="button"
          onClick={() => setImportDay(activeIndex)}
          className="self-start text-sm font-semibold text-primary hover:underline"
        >
          찜에서 불러오기 →
        </button>
      </section>

      {/* ── 1280: 동선 지도 4col ── */}
      <aside aria-label="동선 지도" className="hidden xl:col-span-4 xl:block">
        <div className="sticky top-24 flex flex-col gap-2">
          <p className="text-sm font-semibold">{dayLabels[activeIndex]} 동선</p>
          <RouteMap points={points} className="aspect-square" />
        </div>
      </aside>

      <TripFormDialog
        open={tripForm.open}
        trip={tripForm.trip}
        onOpenChange={(open) => setTripForm((s) => ({ ...s, open }))}
      />
      <TripItemDialog
        tripId={trip.id}
        dayLabels={dayLabels}
        state={itemDialog}
        onOpenChange={(open) => !open && setItemDialog(null)}
      />
      <ImportLikesDialog
        tripId={trip.id}
        dayIndex={importDay}
        dayLabel={importDay !== null ? (dayLabels[importDay] ?? "") : ""}
        likes={likes}
        onOpenChange={(open) => !open && setImportDay(null)}
      />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>‘{trip.title}’ 여행을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 여행의 일정 {trip.items.length}개도 함께 삭제되고 되돌릴 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                startTransition(async () => {
                  await deleteTrip(trip.id);
                  router.replace("/my?tab=planner", { scroll: false });
                })
              }
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
