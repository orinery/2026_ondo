"use client";

import { useState, useTransition } from "react";

import { getPartnerImpact, setPartnerStatus, type PartnerImpact } from "@/actions/partners";
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
import type { PartnerStatus } from "@/lib/constants/taxonomy";

import { failureText } from "./application-actions";

/**
 * 관리자: 파트너 이용 정지 / 정지 해제. 사유 필수(감사 로그).
 * 정지하면 그 파트너의 판매 중 상품이 함께 중지되고, 해제하면 그렇게 중지된 상품만 다시 열린다.
 * 창을 열면 함께 바뀔 상품 수와 이용 전 예약 수를 보여 준다.
 */
export function PartnerStatusAction({
  partnerId,
  name,
  status,
}: {
  partnerId: string;
  name: string;
  status: PartnerStatus;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<PartnerImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [, startLoading] = useTransition(); // 영향 범위 불러오기 (확인 버튼과 따로)
  const suspending = status === "active";
  const fieldId = `partner-status-${partnerId}`;

  const openDialog = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setError(null);
      return;
    }
    setImpact(null);
    startLoading(async () => {
      const result = await getPartnerImpact(partnerId);
      if (result.ok) setImpact(result.impact);
    });
  };

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await setPartnerStatus(partnerId, suspending ? "suspended" : "active", reason);
      if (!result.ok) return setError(failureText(result));
      setOpen(false);
      setReason("");
    });
  };

  const impactText = !impact
    ? "영향 범위를 확인하는 중…"
    : suspending
      ? `판매 중 상품 ${impact.openProducts}개가 함께 중지돼요. 이용 전 예약 ${impact.pending + impact.confirmed}건(확정 대기 ${impact.pending} · 확정 ${impact.confirmed})은 그대로예요 — 확정 대기는 처리하지 못하면 기한 후 자동 취소·전액 환불돼요.`
      : `이용 정지로 함께 중지됐던 상품 ${impact.partnerSuspendedProducts}개가 다시 열려요. 관리자가 따로 중지한 상품은 그대로예요.`;

  return (
    <AlertDialog open={open} onOpenChange={openDialog}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-md">
          {suspending ? "이용 정지" : "정지 해제"}
          <span className="sr-only"> ({name})</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {suspending ? `${name}을(를) 이용 정지할까요?` : `${name}의 정지를 풀까요?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {suspending
              ? "파트너 센터에 들어갈 수 없고 상품을 고칠 수 없어요."
              : "다시 파트너 센터를 쓸 수 있어요."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {impactText}
        </p>
        <FormField
          id={fieldId}
          label={suspending ? "정지 사유 (내부 기록)" : "해제 사유 (내부 기록)"}
          error={error ?? undefined}
          hint={`${reason.trim().length}/200자`}
        >
          <Textarea
            id={fieldId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={200}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${fieldId}-error` : undefined}
          />
        </FormField>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>돌아가기</AlertDialogCancel>
          <Button
            onClick={confirm}
            disabled={pending}
            className={
              suspending
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {pending ? "처리하는 중…" : suspending ? "이용 정지하기" : "정지 해제하기"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
