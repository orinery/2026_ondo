"use client";

import { useState, useTransition } from "react";

import { settleMonth } from "@/actions/settlements";
import { failureText } from "@/components/admin/application-actions";
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
import { formatKrw } from "@/lib/format";

/** 관리자: 파트너 한 곳의 월 정산 완료 처리 — 처리하면 그 달 숫자가 고정된다 (실제 송금 없음) */
export function SettleButton({
  partnerId,
  partnerName,
  month,
  monthText,
  payout,
}: {
  partnerId: string;
  partnerName: string;
  month: string;
  monthText: string;
  payout: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await settleMonth(partnerId, month);
      if (!result.ok) return setError(failureText(result));
      setOpen(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button size="sm" className="rounded-md">
          정산 완료 처리
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {partnerName} · {monthText} 정산을 완료할까요?
          </AlertDialogTitle>
          <AlertDialogDescription>
            지급액 {formatKrw(payout)} — 처리하면 이 달의 숫자가 고정되고 파트너에게 &lsquo;정산
            완료&rsquo;로 보여요. 확정 후에는 되돌릴 수 없고, 이후 환불 조정은 조정한 달의 정산에
            조정 전표로 반영돼요. 모의 정산이라 실제 송금은 일어나지 않아요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>돌아가기</AlertDialogCancel>
          <Button onClick={confirm} disabled={pending}>
            {pending ? "처리하는 중…" : "정산 완료"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
