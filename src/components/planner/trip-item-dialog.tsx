"use client";

import { MapPinIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { addTripItem, updateTripItem } from "@/actions/trips";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ITEM_TYPES, type ItemTypeSlug } from "@/lib/constants/taxonomy";
import type { TripItem } from "@/lib/data/trips";
import { cn } from "@/lib/utils";
import { tripItemSchema } from "@/lib/validation/trip";

import { Field } from "./trip-form-dialog";

type FieldErrors = Partial<Record<"title" | "time" | "note" | "caution", string>>;

export type TripItemDialogState =
  { mode: "add"; dayIndex: number } | { mode: "edit"; item: TripItem } | null;

/**
 * 일정 항목 추가("+ 장소 추가") / 수정(항목 제목 클릭)
 * 수정 창의 'Day' 선택으로 다른 날로 옮길 수 있다 (사용자 확정)
 */
export function TripItemDialog({
  tripId,
  dayLabels,
  state,
  onOpenChange,
}: {
  tripId: string;
  dayLabels: string[];
  state: TripItemDialogState;
  onOpenChange: (open: boolean) => void;
}) {
  const ids = useId();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const item = state?.mode === "edit" ? state.item : null;
  const initialDay = state?.mode === "edit" ? state.item.dayIndex : (state?.dayIndex ?? 0);
  const [dayIndex, setDayIndex] = useState(initialDay);
  const [type, setType] = useState<ItemTypeSlug>(item?.type ?? "sight");
  const [prevState, setPrevState] = useState(state);
  // 창을 다른 항목으로 다시 열면 선택값을 그 항목 기준으로 맞춘다
  if (state !== prevState) {
    setPrevState(state);
    setDayIndex(initialDay);
    setType(item?.type ?? "sight");
    setErrors({});
    setFormError(null);
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = {
      title: form.get("title"),
      dayIndex,
      time: form.get("time"),
      type,
      note: form.get("note"),
      caution: form.get("caution"),
    };
    const parsed = tripItemSchema.safeParse(input);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (
          (key === "title" || key === "time" || key === "note" || key === "caution") &&
          !next[key]
        ) {
          next[key] = issue.message;
        }
      }
      setErrors(next);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = item
        ? await updateTripItem(tripId, item.id, input)
        : await addTripItem(tripId, input);
      if (!result.ok)
        return setFormError(result.message ?? "저장하지 못했어요. 다시 시도해 주세요");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <form
          key={item?.id ?? `add-${initialDay}`}
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{item ? "일정 수정" : "장소 추가"}</DialogTitle>
            <DialogDescription>
              {item?.destination ? (
                <span className="inline-flex items-center gap-1">
                  <MapPinIcon aria-hidden className="size-3.5" />
                  {item.destination.name}과(와) 연결된 일정이에요 (동선 지도에 표시)
                </span>
              ) : (
                "여행지와 연결되지 않은 장소는 동선 지도에 표시되지 않아요."
              )}
            </DialogDescription>
          </DialogHeader>

          <Field id={`${ids}-title`} label="장소 이름" error={errors.title}>
            <Input
              id={`${ids}-title`}
              name="title"
              defaultValue={item?.title}
              placeholder="예: 니시키 시장"
              maxLength={60}
              aria-invalid={Boolean(errors.title) || undefined}
              className="h-12 text-base md:text-base"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <span id={`${ids}-day`} className="text-sm font-medium">
                날짜
              </span>
              <Select value={String(dayIndex)} onValueChange={(v) => setDayIndex(Number(v))}>
                <SelectTrigger aria-labelledby={`${ids}-day`} className="h-12! w-full text-base">
                  <SelectValue>{dayLabels[dayIndex]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {dayLabels.map((label, i) => (
                    <SelectItem key={label} value={String(i)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field id={`${ids}-time`} label="시간 (선택)" error={errors.time}>
              <Input
                id={`${ids}-time`}
                name="time"
                type="time"
                defaultValue={item?.time ?? ""}
                className="h-12 text-base md:text-base"
              />
            </Field>
          </div>

          {/* 유형: 이동 / 관광 / 식사 (명세 5.4 태그) */}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">유형</legend>
            <div role="radiogroup" className="flex gap-2">
              {ITEM_TYPES.map((t) => (
                <label key={t.value} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="type-choice"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex h-11 items-center justify-center rounded-md border text-sm font-medium transition-colors duration-fast peer-focus-visible:shadow-focus",
                      type === t.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-stone-500 bg-card",
                    )}
                  >
                    {t.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field id={`${ids}-note`} label="메모 (선택)" error={errors.note}>
            <Input
              id={`${ids}-note`}
              name="note"
              defaultValue={item?.note ?? ""}
              placeholder="예: 점심 · 길거리 음식"
              maxLength={200}
              className="h-12 text-base md:text-base"
            />
          </Field>
          <Field id={`${ids}-caution`} label="주의 메모 (선택)" error={errors.caution}>
            <Input
              id={`${ids}-caution`}
              name="caution"
              defaultValue={item?.caution ?? ""}
              placeholder="예: 수요일 휴무 — 입력하면 경고로 표시돼요"
              maxLength={60}
              className="h-12 text-base md:text-base"
            />
          </Field>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="h-11 rounded-md px-6">
              {pending ? "저장하는 중…" : item ? "저장" : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
