"use client";

import { useState, useTransition } from "react";

import { approveApplication, rejectApplication } from "@/actions/partners";
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
import type { ActionResult } from "@/lib/action-result";

/** 실패 결과 → 화면 문장 */
export function failureText(result: Exclude<ActionResult, { ok: true }>) {
  if (result.reason === "unauthenticated") return "로그인이 필요해요. 다시 로그인해 주세요.";
  return result.message ?? "처리하지 못했어요. 다시 시도해 주세요.";
}

/**
 * 관리자: 파트너 신청 승인·거절 버튼.
 * 승인하면 DB 함수가 파트너를 만들고 신청자 역할을 partner로 바꾼다. 결과를 기다리는 동안 창을 닫지 않는다.
 */
export function ApplicationActions({
  applicationId,
  businessName,
}: {
  applicationId: string;
  businessName: string;
}) {
  return (
    <div className="flex gap-2">
      <ApproveDialog applicationId={applicationId} businessName={businessName} />
      <RejectDialog applicationId={applicationId} businessName={businessName} />
    </div>
  );
}

function ApproveDialog({
  applicationId,
  businessName,
}: {
  applicationId: string;
  businessName: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveApplication(applicationId);
      if (!result.ok) return setError(failureText(result));
      // revalidatePath로 목록이 다시 그려지므로 창만 닫는다
      setOpen(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button className="h-10 rounded-md px-4">승인</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{businessName} 신청을 승인할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            신청한 계정이 파트너가 되어 파트너 센터에서 상품을 등록할 수 있어요. 기본 수수료는
            15%예요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>돌아가기</AlertDialogCancel>
          {/* AlertDialogAction은 누르면 바로 닫히므로, 결과를 기다리는 일반 버튼을 쓴다 */}
          <Button onClick={confirm} disabled={pending}>
            {pending ? "승인하는 중…" : "승인하기"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RejectDialog({
  applicationId,
  businessName,
}: {
  applicationId: string;
  businessName: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldId = `reject-reason-${applicationId}`;

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await rejectApplication(applicationId, reason);
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
        <Button variant="outline" className="h-10 rounded-md px-4">
          거절
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{businessName} 신청을 거절할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            사유는 신청자에게 보여요. 신청자는 내용을 보완해 다시 신청할 수 있어요.
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
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${fieldId}-error` : undefined}
          />
        </FormField>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>돌아가기</AlertDialogCancel>
          {/* 채운 빨강: shadcn destructive 변형(옅은 배경)은 다크 모드 대비가 부족하다 (예약 취소와 같은 이유) */}
          <Button
            onClick={confirm}
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
