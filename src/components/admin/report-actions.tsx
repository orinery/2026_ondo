"use client";

import { useState, useTransition } from "react";

import { resolveReport, setReviewHidden } from "@/actions/admin";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

import { failureText } from "./application-actions";

type Kind = "dismiss" | "hide" | "unhide";

const COPY: Record<
  Kind,
  { button: string; title: string; description: string; destructive: boolean }
> = {
  dismiss: {
    button: "기각",
    title: "신고를 기각할까요?",
    description: "리뷰는 그대로 보여요.",
    destructive: false,
  },
  hide: {
    button: "리뷰 숨김",
    title: "이 리뷰를 숨길까요?",
    description:
      "작성자와 관리자에게만 보이고 평점에서 빠져요. 같은 리뷰의 다른 신고도 함께 처리돼요.",
    destructive: true,
  },
  unhide: {
    button: "숨김 해제",
    title: "리뷰를 다시 공개할까요?",
    description: "모두에게 보이고 평점에 다시 포함돼요.",
    destructive: false,
  },
};

/** 관리자: 리뷰 신고 처리 버튼 — 대기 중이면 기각·숨김, 숨긴 리뷰면 숨김 해제 */
export function ReportActions({
  reportId,
  reviewId,
  pending,
  hidden,
}: {
  reportId: string;
  reviewId: string;
  pending: boolean;
  hidden: boolean;
}) {
  if (pending) {
    return (
      <div className="flex gap-2">
        <ConfirmButton kind="dismiss" run={() => resolveReport(reportId, "dismiss")} />
        <ConfirmButton kind="hide" run={() => resolveReport(reportId, "hide")} />
      </div>
    );
  }
  return hidden ? (
    <ConfirmButton kind="unhide" run={() => setReviewHidden(reviewId, false)} />
  ) : null;
}

function ConfirmButton({ kind, run }: { kind: Kind; run: () => Promise<ActionResult> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const copy = COPY[kind];

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) return setError(failureText(result));
      setOpen(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={kind === "hide" ? "default" : "outline"} className="rounded-md">
          {copy.button}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>돌아가기</AlertDialogCancel>
          <Button
            onClick={confirm}
            disabled={busy}
            className={
              copy.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {busy ? "처리하는 중…" : copy.button}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
