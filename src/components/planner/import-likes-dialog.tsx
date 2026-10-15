"use client";

import { HeartIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";

import { addDestinationsToTrip } from "@/actions/trips";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type LikeOption = {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  imageUrl: string;
  imageAlt: string;
};

/** "찜에서 불러오기" — 찜한 여행지를 골라 그날 일정 끝에 담는다 (명세 5.4 empty의 동작) */
export function ImportLikesDialog({
  tripId,
  dayIndex,
  dayLabel,
  likes,
  onOpenChange,
}: {
  tripId: string;
  dayIndex: number | null; // null = 닫힘
  dayLabel: string;
  likes: LikeOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = () => {
    if (dayIndex === null || selected.length === 0) return;
    startTransition(async () => {
      // 고른 순서대로 그날 끝에 붙는다
      const result = await addDestinationsToTrip(tripId, dayIndex, selected);
      if (!result.ok) return setError(result.message ?? "담지 못했어요. 다시 시도해 주세요");
      setSelected([]);
      onOpenChange(false);
    });
  };

  return (
    <Dialog
      open={dayIndex !== null}
      onOpenChange={(open) => {
        if (!open) setSelected([]);
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>찜에서 불러오기</DialogTitle>
          <DialogDescription>
            {dayLabel}에 담을 여행지를 골라 주세요. 고른 순서대로 추가돼요.
          </DialogDescription>
        </DialogHeader>

        {likes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <HeartIcon aria-hidden className="size-6 text-muted-foreground" />
            <p className="font-semibold">아직 찜한 여행지가 없어요</p>
            <Link
              href="/destinations"
              className="text-sm font-semibold text-primary hover:underline"
            >
              여행지 둘러보기 →
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="찜한 여행지">
            {likes.map((d) => {
              const order = selected.indexOf(d.id);
              return (
                <li key={d.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border p-2 transition-colors duration-fast has-focus-visible:shadow-focus",
                      order >= 0 ? "border-primary bg-accent" : "hover:bg-muted",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={order >= 0}
                      onChange={() => toggle(d.id)}
                      className="sr-only"
                    />
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-muted">
                      <Image src={d.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{d.name}</span>
                      <span className="block text-sm text-muted-foreground">{d.country}</span>
                    </span>
                    {/* 고른 순서 번호 */}
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-7 place-items-center rounded-full text-sm font-semibold",
                        order >= 0 ? "bg-primary text-primary-foreground" : "border border-input",
                      )}
                    >
                      {order >= 0 ? order + 1 : ""}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={pending || selected.length === 0}
            className="h-11 rounded-md px-6"
          >
            {pending ? "담는 중…" : `${selected.length}곳 담기`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
