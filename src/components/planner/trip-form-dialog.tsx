"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { createTrip, updateTrip } from "@/actions/trips";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TripSummary } from "@/lib/data/trips";
import { MAX_TRIP_DAYS, tripSchema } from "@/lib/validation/trip";

type FieldErrors = Partial<Record<"title" | "startDate" | "endDate", string>>;

/** 새 여행 만들기 / 여행 정보 수정 (제목 + 시작일·종료일, 최대 30일) */
export function TripFormDialog({
  open,
  onOpenChange,
  trip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: TripSummary | null; // 있으면 수정 모드
}) {
  const router = useRouter();
  const ids = useId();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = tripSchema.safeParse({
      title: form.get("title"),
      startDate: form.get("startDate"),
      endDate: form.get("endDate"),
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === "title" || key === "startDate" || key === "endDate") && !next[key])
          next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setFormError(null);

    startTransition(async () => {
      if (trip) {
        const result = await updateTrip(trip.id, parsed.data);
        if (!result.ok)
          return setFormError(result.message ?? "저장하지 못했어요. 다시 시도해 주세요");
        onOpenChange(false);
      } else {
        const result = await createTrip(parsed.data);
        if (!result.ok)
          return setFormError(result.message ?? "만들지 못했어요. 다시 시도해 주세요");
        onOpenChange(false);
        // 새로 만든 여행을 바로 연다
        router.push(`/my?tab=planner&trip=${result.tripId}`, { scroll: false });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* key: 열 때마다 입력값을 현재 여행 기준으로 초기화 */}
        <form
          key={`${open}-${trip?.id ?? "new"}`}
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{trip ? "여행 정보 수정" : "새 여행 만들기"}</DialogTitle>
            <DialogDescription>
              여행 기간은 최대 {MAX_TRIP_DAYS}일까지 정할 수 있어요.
            </DialogDescription>
          </DialogHeader>
          <Field id={`${ids}-title`} label="여행 이름" error={errors.title}>
            <Input
              id={`${ids}-title`}
              name="title"
              defaultValue={trip?.title}
              placeholder="예: 교토 가을 여행"
              maxLength={50}
              aria-invalid={Boolean(errors.title) || undefined}
              className="h-12 text-base md:text-base"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${ids}-start`} label="시작하는 날" error={errors.startDate}>
              <Input
                id={`${ids}-start`}
                name="startDate"
                type="date"
                defaultValue={trip?.startDate}
                aria-invalid={Boolean(errors.startDate) || undefined}
                className="h-12 text-base md:text-base"
              />
            </Field>
            <Field id={`${ids}-end`} label="끝나는 날" error={errors.endDate}>
              <Input
                id={`${ids}-end`}
                name="endDate"
                type="date"
                defaultValue={trip?.endDate}
                aria-invalid={Boolean(errors.endDate) || undefined}
                className="h-12 text-base md:text-base"
              />
            </Field>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="h-11 rounded-md px-6">
              {pending ? "저장하는 중…" : trip ? "저장" : "만들기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
