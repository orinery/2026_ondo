"use client";

import { CalendarPlusIcon, CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";

import { addDestinationsToTrip, createTrip } from "@/actions/trips";
import { Field } from "@/components/planner/trip-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TripSummary } from "@/lib/data/trips";
import { tripDayCount, tripDayLabel, tripRangeLabel } from "@/lib/trip-dates";
import { cn } from "@/lib/utils";
import { tripSchema } from "@/lib/validation/trip";

const NEW_TRIP = "__new__";

/**
 * 상세의 "일정에 담기" (사용자 확정: 여행·Day를 고르는 다이얼로그)
 * 여행이 없거나 "새 여행"을 고르면 같은 창에서 여행을 만들고 Day 1에 담는다.
 */
export function AddToTripDialog({
  destinationId,
  destinationName,
  slug,
  trips,
  isLoggedIn,
  className,
}: {
  destinationId: string;
  destinationName: string;
  slug: string;
  trips: TripSummary[];
  isLoggedIn: boolean;
  className?: string;
}) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [tripId, setTripId] = useState(trips[0]?.id ?? NEW_TRIP);
  const [dayIndex, setDayIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ tripId: string; label: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const triggerClass = cn("h-11 gap-1.5 rounded-md px-5 text-base", className);

  if (!isLoggedIn) {
    return (
      <Button asChild className={triggerClass}>
        <Link href={`/login?next=${encodeURIComponent(`/destinations/${slug}`)}`}>
          <CalendarPlusIcon aria-hidden className="size-4" />
          일정에 담기
        </Link>
      </Button>
    );
  }

  const trip = trips.find((t) => t.id === tripId) ?? null;
  const dayCount = trip ? tripDayCount(trip.startDate, trip.endDate) : 0;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      let targetId = trip?.id;
      let label = trip ? `${trip.title} · ${tripDayLabel(trip.startDate, dayIndex)}` : "";

      if (!trip) {
        const parsed = tripSchema.safeParse({
          title: form.get("title"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
        });
        if (!parsed.success)
          return setError(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요");
        const created = await createTrip(parsed.data);
        if (!created.ok) return setError(created.message ?? "여행을 만들지 못했어요");
        targetId = created.tripId;
        label = `${parsed.data.title} · ${tripDayLabel(parsed.data.startDate, 0)}`;
      }
      if (!targetId) return;

      const result = await addDestinationsToTrip(targetId, trip ? dayIndex : 0, [destinationId]);
      if (!result.ok) return setError(result.message ?? "담지 못했어요. 다시 시도해 주세요");
      setDone({ tripId: targetId, label });
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setDone(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className={triggerClass}>
          <CalendarPlusIcon aria-hidden className="size-4" />
          일정에 담기
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {done ? (
          // 완료 상태: 바로 일정으로 이동할 수 있게 한다
          <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2Icon aria-hidden className="size-8 text-success" />
            <DialogTitle>일정에 담았어요</DialogTitle>
            <DialogDescription>
              {destinationName} → {done.label}
            </DialogDescription>
            <Button asChild className="mt-2 h-11 rounded-md px-5">
              <Link href={`/my?tab=planner&trip=${done.tripId}`}>일정 보러 가기</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>일정에 담기</DialogTitle>
              <DialogDescription>
                {destinationName}을(를) 어느 여행, 어느 날에 담을까요?
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <span id={`${ids}-trip`} className="text-sm font-medium">
                여행
              </span>
              <Select
                value={tripId}
                onValueChange={(v) => {
                  setTripId(v);
                  setDayIndex(0);
                }}
              >
                <SelectTrigger aria-labelledby={`${ids}-trip`} className="h-12! w-full text-base">
                  <SelectValue>{trip ? trip.title : "+ 새 여행 만들기"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {trips.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title} · {tripRangeLabel(t.startDate, t.endDate)}
                    </SelectItem>
                  ))}
                  {trips.length > 0 && <SelectSeparator />}
                  <SelectItem value={NEW_TRIP}>+ 새 여행 만들기</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {trip ? (
              <div className="flex flex-col gap-2">
                <span id={`${ids}-day`} className="text-sm font-medium">
                  날짜
                </span>
                <Select value={String(dayIndex)} onValueChange={(v) => setDayIndex(Number(v))}>
                  <SelectTrigger aria-labelledby={`${ids}-day`} className="h-12! w-full text-base">
                    <SelectValue>{tripDayLabel(trip.startDate, dayIndex)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: dayCount }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {tripDayLabel(trip.startDate, i)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              // 새 여행: 같은 창에서 만들고 Day 1에 담는다
              <>
                <Field id={`${ids}-title`} label="여행 이름">
                  <Input
                    id={`${ids}-title`}
                    name="title"
                    defaultValue={`${destinationName} 여행`}
                    maxLength={50}
                    className="h-12 text-base md:text-base"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id={`${ids}-start`} label="시작하는 날">
                    <Input
                      id={`${ids}-start`}
                      name="startDate"
                      type="date"
                      className="h-12 text-base md:text-base"
                    />
                  </Field>
                  <Field id={`${ids}-end`} label="끝나는 날">
                    <Input
                      id={`${ids}-end`}
                      name="endDate"
                      type="date"
                      className="h-12 text-base md:text-base"
                    />
                  </Field>
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending} className="h-11 rounded-md px-6">
                {pending ? "담는 중…" : trip ? "담기" : "여행 만들고 담기"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
