"use client";

import { useState, useTransition } from "react";

import { setProductSuspension } from "@/actions/admin";
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

import { failureText } from "./application-actions";

/**
 * 관리자: 상품 판매 중지 / 재개.
 * 중지하면 목록에 "판매 중지"로 보이고 새 예약이 막힌다. 이미 받은 예약은 그대로 (취소는 고객·파트너 흐름으로).
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
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldId = `suspend-${productId}`;

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await setProductSuspension(productId, suspended ? null : reason);
      if (!result.ok) return setError(failureText(result));
      setOpen(false);
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
              ? "파트너가 공개해 둔 상태라면 다시 예약을 받아요."
              : "새 예약이 막히고 목록에 '판매 중지'로 보여요. 이미 받은 예약은 그대로예요. 사유는 파트너에게 보여요."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!suspended && (
          <FormField
            id={fieldId}
            label="중지 사유"
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
        )}
        {suspended && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
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
