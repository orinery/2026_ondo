"use client";

import { useState, useTransition } from "react";

import { adjustRefund } from "@/actions/admin-orders";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatKrw } from "@/lib/format";

import { failureText } from "./application-actions";

/**
 * 관리자: 환불 조정 (규정 밖 추가 환불 — 분쟁 합의·수수료 면제 등). 환불액은 늘리기만 한다.
 * 이용월이 이미 정산 완료됐으면 완료 숫자는 그대로 두고, 이번 달 정산에 조정 전표로 반영된다.
 */
export function RefundAdjustDialog({
  orderNo,
  itemId,
  title,
  subtotal,
  currentRefund,
  settledMonthNote,
}: {
  orderNo: string;
  itemId: string;
  title: string;
  subtotal: number;
  currentRefund: number;
  settledMonthNote: string | null; // 정산 완료 달이면 "2026년 10월 정산에 조정 전표로 반영돼요" 같은 안내
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const amountId = `refund-amount-${itemId}`;
  const reasonId = `refund-reason-${itemId}`;
  const value = Number(amount.replaceAll(",", ""));
  const increase = Number.isInteger(value) && value > currentRefund ? value - currentRefund : null;

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await adjustRefund({ orderNo, itemId, amount: value, reason });
      if (!result.ok) return setError(failureText(result));
      setOpen(false);
      setAmount("");
      setReason("");
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
          환불 조정<span className="sr-only"> ({title})</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>환불액을 조정할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {title} — 결제 {formatKrw(subtotal)} · 지금 환불 {formatKrw(currentRefund)}. 환불액은
            늘리기만 할 수 있고, 조정은 되돌릴 수 없어요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FormField
          id={amountId}
          label="새 환불액 (원)"
          hint={
            increase
              ? `${formatKrw(increase)} 추가 환불 · 파트너 매출에서 빠져요`
              : `${formatKrw(currentRefund + 1)} ~ ${formatKrw(subtotal)}`
          }
        >
          <Input
            id={amountId}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ""))}
            className="h-11 tabular-nums"
          />
        </FormField>
        <FormField
          id={reasonId}
          label="조정 사유 (내부 기록)"
          error={error ?? undefined}
          hint={`${reason.trim().length}/200자`}
        >
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="예: 현장 픽업 지연으로 고객과 50% 환불 합의"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${reasonId}-error` : undefined}
          />
        </FormField>
        {settledMonthNote && (
          <p className="rounded-md border border-warning/50 px-3 py-2 text-sm text-warning">
            {settledMonthNote}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>돌아가기</AlertDialogCancel>
          <Button onClick={confirm} disabled={pending}>
            {pending ? "처리하는 중…" : "조정하기"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
