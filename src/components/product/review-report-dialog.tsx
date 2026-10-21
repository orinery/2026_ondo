"use client";

import { FlagIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { reportReview } from "@/actions/reviews";
import { FormField } from "@/components/form/form-field";
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
import { Textarea } from "@/components/ui/textarea";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants/taxonomy";

/**
 * 리뷰 신고 창 — 사유를 고르고(필수) 내용을 덧붙인다(선택).
 * 관리자가 확인한 뒤 기각하거나 리뷰를 숨긴다. 본인 리뷰·같은 리뷰 중복 신고는 DB가 막는다.
 */
export function ReviewReportDialog({
  reviewId,
  authorName,
}: {
  reviewId: string;
  authorName: string;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    if (!reason) return setError("신고 사유를 골라 주세요.");
    startTransition(async () => {
      const result = await reportReview({ reviewId, reason, detail });
      if (!result.ok) {
        return setError(
          result.reason === "unauthenticated"
            ? "로그인이 필요해요."
            : (result.message ?? "신고하지 못했어요. 다시 시도해 주세요."),
        );
      }
      setDone(true);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) {
          setError(null);
          if (done) {
            setDone(false);
            setReason(null);
            setDetail("");
          }
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 rounded-md px-2 text-muted-foreground">
          <FlagIcon aria-hidden className="size-3.5" />
          신고<span className="sr-only"> ({authorName}님의 리뷰)</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>리뷰 신고</DialogTitle>
          <DialogDescription>
            {authorName}님의 리뷰를 신고해요. 관리자가 확인한 뒤 숨김 여부를 정해요.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <p
            role="status"
            className="rounded-md bg-accent px-4 py-3 text-sm text-accent-foreground"
          >
            신고를 접수했어요. 알려 주셔서 고마워요.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">사유</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2.5 text-sm">
                  <input
                    type="radio"
                    name={`${uid}-reason`}
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="size-4 accent-primary"
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <FormField
              id={`${uid}-detail`}
              label="자세한 내용 (선택)"
              hint={`${detail.trim().length}/300자`}
              error={error ?? undefined}
            >
              <Textarea
                id={`${uid}-detail`}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={3}
                maxLength={300}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? `${uid}-detail-error` : undefined}
              />
            </FormField>
          </div>
        )}
        <DialogFooter>
          {done ? (
            <Button onClick={() => setOpen(false)}>닫기</Button>
          ) : (
            <Button onClick={submit} disabled={pending}>
              {pending ? "신고하는 중…" : "신고하기"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
