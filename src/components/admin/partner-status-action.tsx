"use client";

import { useState, useTransition } from "react";

import { setPartnerStatus } from "@/actions/partners";
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
import type { PartnerStatus } from "@/lib/constants/taxonomy";

import { failureText } from "./application-actions";

/** 관리자: 파트너 이용 정지 / 정지 해제 */
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const suspending = status === "active";

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await setPartnerStatus(partnerId, suspending ? "suspended" : "active");
      if (!result.ok) return setError(failureText(result));
      setOpen(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-md">
          {suspending ? "이용 정지" : "정지 해제"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {suspending ? `${name}을(를) 이용 정지할까요?` : `${name}의 정지를 풀까요?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {suspending
              ? "파트너 센터에 들어갈 수 없고 상품을 고칠 수 없어요. 공개된 상품의 판매는 그대로예요."
              : "다시 파트너 센터를 쓸 수 있어요."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
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
