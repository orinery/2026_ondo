"use client";

import { useState, useTransition } from "react";

import { cancelItemAsOperator } from "@/actions/admin-orders";
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
import { formatKrw } from "@/lib/format";
import { OPERATOR_CANCEL_REASONS, type OperatorCancelReason } from "@/lib/operator-cancel";

import { failureText } from "./application-actions";

/**
 * 관리자: 운영자 취소 (확정 대기·확정 항목).
 * 사유 코드가 환불을 정한다 — 파트너 사정·기상·최소 인원 미달은 전액, 고객 요청은 취소 규정대로.
 * 고객 요청 대행은 고객 본인 취소와 같이 이용일 전날까지만 고를 수 있다.
 */
export function OperatorCancelDialog({
  orderNo,
  itemId,
  title,
  subtotal,
  policyRefund,
}: {
  orderNo: string;
  itemId: string;
  title: string;
  subtotal: number;
  policyRefund: { amount: number; label: string } | null; // 고객 요청일 때 환불 (null = 이용일 당일이라 불가)
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<OperatorCancelReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldId = `operator-cancel-${itemId}`;

  const reason = OPERATOR_CANCEL_REASONS.find((r) => r.code === code);
  const refund = !reason ? null : reason.fullRefund ? subtotal : (policyRefund?.amount ?? null);

  const confirm = () => {
    setError(null);
    if (!code) return setError("취소 사유를 골라 주세요.");
    startTransition(async () => {
      const result = await cancelItemAsOperator({ orderNo, itemId, reasonCode: code, note });
      if (!result.ok) return setError(failureText(result));
      setOpen(false);
      setCode(null);
      setNote("");
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
          운영자 취소<span className="sr-only"> ({title})</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>이 예약을 취소할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {title} — 좌석이 돌아가고 고객 예약 내역에 사유와 환불액이 보여요. 취소는 되돌릴 수
            없어요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">취소 사유</legend>
          {OPERATOR_CANCEL_REASONS.map((r) => {
            const disabled = !r.fullRefund && !policyRefund;
            return (
              <label
                key={r.code}
                className={`flex items-start gap-2.5 text-sm ${disabled ? "opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name={`${fieldId}-code`}
                  value={r.code}
                  checked={code === r.code}
                  disabled={disabled || pending}
                  onChange={() => setCode(r.code)}
                  className="mt-1 size-4 accent-primary"
                />
                <span>
                  <span className="font-medium">{r.label}</span>
                  <span className="block text-muted-foreground">
                    {r.fullRefund
                      ? `전액 환불 ${formatKrw(subtotal)}`
                      : policyRefund
                        ? `취소 규정대로 ${policyRefund.label} · ${formatKrw(policyRefund.amount)}`
                        : "이용일 당일에는 고객 요청으로 취소할 수 없어요"}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <FormField
          id={fieldId}
          label="고객 안내 (고객 예약 내역에 보여요)"
          error={error ?? undefined}
          hint={`${note.trim().length}/200자`}
        >
          <Textarea
            id={fieldId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="예: 태풍 접근으로 해당 날짜 운항이 취소됐어요"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${fieldId}-error` : undefined}
          />
        </FormField>
        {refund !== null && (
          <p className="text-sm">
            환불 예정액 <span className="font-semibold tabular-nums">{formatKrw(refund)}</span>
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>돌아가기</AlertDialogCancel>
          <Button
            onClick={confirm}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "처리하는 중…" : "취소하기"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
