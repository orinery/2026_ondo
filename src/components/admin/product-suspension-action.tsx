"use client";

import { useState, useTransition } from "react";

import { getProductImpact, setProductSuspension, type ProductImpact } from "@/actions/admin";
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

import { failureText } from "./application-actions";

const KINDS = [
  {
    value: "info_fix",
    label: "정보 수정 필요",
    description: "새 예약만 막아요. 이미 받은 예약은 그대로 진행돼요.",
  },
  {
    value: "unsafe",
    label: "운영 불가·위험",
    description: "이용 전 예약(확정 대기·확정)을 모두 전액 환불로 함께 취소해요.",
  },
] as const;

/**
 * 관리자: 상품 판매 중지 / 재개. 사유는 둘 다 필수(감사 로그), 중지 사유는 파트너에게 보인다.
 * 창을 열면 이용 전 예약 수를 불러와 "운영 불가"로 중지할 때 취소될 범위를 보여 준다.
 * 판매 중지 상품은 공개 목록에서 빠지고, 상세는 기존 예약자를 위해 남는다.
 */
export function ProductSuspensionAction({
  productId,
  title,
  suspended,
}: {
  productId: string;
  title: string;
  suspended: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"info_fix" | "unsafe" | null>(null);
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<ProductImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [, startLoading] = useTransition(); // 영향 범위 불러오기 (확인 버튼과 따로)
  const fieldId = `suspend-${productId}`;
  const affected = impact ? impact.pending + impact.confirmed : 0;

  const openDialog = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setError(null);
      return;
    }
    if (!suspended) {
      setImpact(null);
      startLoading(async () => {
        const result = await getProductImpact(productId);
        if (result.ok) setImpact(result.impact);
      });
    }
  };

  const confirm = () => {
    setError(null);
    if (!suspended && !kind) return setError("중지 종류를 골라 주세요.");
    startTransition(async () => {
      const result = await setProductSuspension(productId, {
        suspend: !suspended,
        kind: suspended ? null : kind,
        reason,
      });
      if (!result.ok) return setError(failureText(result));
      setOpen(false);
      setReason("");
      setKind(null);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={openDialog}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-md">
          {suspended ? "판매 재개" : "판매 중지"}
          <span className="sr-only"> ({title})</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {suspended ? "판매를 다시 열까요?" : "이 상품의 판매를 중지할까요?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {title} —{" "}
            {suspended
              ? "파트너가 공개해 둔 상태라면 다시 목록에 보이고 예약을 받아요."
              : "새 예약이 막히고 상품 목록에서 빠져요. 사유는 파트너에게 보여요."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!suspended && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">중지 종류</legend>
            {KINDS.map((k) => (
              <label key={k.value} className="flex items-start gap-2.5 text-sm">
                <input
                  type="radio"
                  name={`${fieldId}-kind`}
                  value={k.value}
                  checked={kind === k.value}
                  disabled={pending}
                  onChange={() => setKind(k.value)}
                  className="mt-1 size-4 accent-primary"
                />
                <span>
                  <span className="font-medium">{k.label}</span>
                  <span className="block text-muted-foreground">{k.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {!suspended && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {impact === null
              ? "이용 전 예약을 확인하는 중…"
              : affected === 0
                ? "이용 전 예약이 없어요."
                : `이용 전 예약 ${affected}건 (확정 대기 ${impact.pending} · 확정 ${impact.confirmed}) · ${formatKrw(impact.refundTotal)}`}
          </p>
        )}
        {kind === "unsafe" && affected > 0 && (
          <p className="rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
            {affected}건을 전액 환불({formatKrw(impact?.refundTotal ?? 0)})로 취소해요. 되돌릴 수
            없어요.
          </p>
        )}
        <FormField
          id={fieldId}
          label={suspended ? "재개 사유 (내부 기록)" : "중지 사유 (파트너에게 보여요)"}
          error={error ?? undefined}
          hint={`${reason.trim().length}/100자`}
        >
          <Textarea
            id={fieldId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={100}
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
              suspended
                ? undefined
                : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            }
          >
            {pending ? "처리하는 중…" : suspended ? "판매 재개" : "판매 중지"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
