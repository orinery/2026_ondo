"use client";

import { useState, useTransition } from "react";

import { confirmBooking, rejectBooking } from "@/actions/partner-bookings";
import { failureText } from "@/components/admin/application-actions";
import { FormField } from "@/components/form/form-field";
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
import { Textarea } from "@/components/ui/textarea";

/**
 * 파트너: 확정 대기 예약의 확정·거절 버튼.
 * 결과를 기다리는 동안 창을 닫지 않는다. 처리되면 서버 액션이 목록을 다시 그린다(revalidatePath).
 */
export function BookingActions({ itemId, title }: { itemId: string; title: string }) {
  return (
    <div className="flex gap-2">
      <ConfirmDialog itemId={itemId} title={title} />
      <RejectDialog itemId={itemId} title={title} />
    </div>
  );
}

function ConfirmDialog({ itemId, title }: { itemId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmBooking(itemId);
      if (!result.ok) return setError(failureText(result));
      if (result.result === "expired") {
        // 기한이 지나 확정 대신 자동 취소됨 — 창에 이유를 남긴다
        return setError("확정 기한이 지나 이 예약은 자동 취소·전액 환불됐어요.");
      }
      setOpen(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button size="sm" className="rounded-md">
          확정
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>이 예약을 확정할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {title} — 확정하면 고객에게 바우처가 발급돼요. 확정 후 취소는 고객의 취소 규정을 따라요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>닫기</AlertDialogCancel>
          {/* AlertDialogAction은 누르면 바로 닫히므로, 결과를 기다리는 일반 버튼을 쓴다 */}
          <Button onClick={confirm} disabled={pending}>
            {pending ? "확정하는 중…" : "확정하기"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RejectDialog({ itemId, title }: { itemId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldId = `booking-reject-${itemId}`;

  const reject = () => {
    setError(null);
    startTransition(async () => {
      const result = await rejectBooking(itemId, reason);
      if (!result.ok) return setError(failureText(result));
      setOpen(false);
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-md">
          거절
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>이 예약을 거절할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {title} — 고객에게 전액 환불되고 사유가 보여요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FormField
          id={fieldId}
          label="거절 사유"
          error={error ?? undefined}
          hint={`${reason.trim().length}/200자`}
        >
          <Textarea
            id={fieldId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="예: 기상 악화로 해당 날짜 운항이 취소됐어요"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${fieldId}-error` : undefined}
          />
        </FormField>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>닫기</AlertDialogCancel>
          {/* 채운 빨강: 옅은 destructive 변형은 다크 모드 대비가 부족하다 */}
          <Button
            onClick={reject}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "거절하는 중…" : "거절하기"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
