"use client";

import { useActionState, useState } from "react";

import { deleteAccount } from "@/actions/account";
import { FormField } from "@/components/auth/form-field";
import { useFieldValidation } from "@/components/auth/use-field-validation";
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
import { deleteAccountSchema, type AuthFormState } from "@/lib/validation/auth";

import { AccountCard, FormResult } from "./account-card";

const INITIAL: AuthFormState = { status: "idle" };

/**
 * 회원 탈퇴 — 막는 사유(이용 예정 예약·파트너/관리자)가 있으면 미리 알리고 버튼을 막는다.
 * 확인 창에서 현재 비밀번호를 다시 입력해야 탈퇴된다. 성공하면 서버가 메인으로 보낸다.
 */
export function DeleteAccountSection({ blockedReason }: { blockedReason: string | null }) {
  const [open, setOpen] = useState(false);
  // 성공하면 deleteAccount가 메인으로 보내고(redirect), 내비는 이동 뒤 /api/me로 비로그인을 다시 불러온다.
  // 돌아온 상태가 있다면 실패(비밀번호 틀림·막는 사유) → 창을 연 채 이유를 보여 준다
  const [state, action, pending] = useActionState(deleteAccount, INITIAL);
  const { errors, register } = useFieldValidation(deleteAccountSchema, state);

  return (
    <AccountCard
      id="delete-title"
      title="회원 탈퇴"
      tone="danger"
      description={
        <ul className="list-disc space-y-1 pl-5">
          <li>찜·일정 플래너·장바구니·리뷰(사진 포함)가 바로 지워지고 되돌릴 수 없어요.</li>
          <li>
            주문 기록은 관계 법령에 따라 정해진 기간 동안 보관되지만, 탈퇴 후에는 다시 볼 수 없어요.
          </li>
        </ul>
      }
    >
      {blockedReason && (
        <p role="status" className="rounded-md bg-muted px-4 py-3 text-sm">
          {blockedReason}
        </p>
      )}
      <div className="flex justify-end">
        <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={Boolean(blockedReason)}
              className="h-11 rounded-md px-5 text-base"
            >
              회원 탈퇴
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>정말 탈퇴할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                계정과 찜·일정·리뷰가 지워지고 되돌릴 수 없어요. 본인 확인을 위해 현재 비밀번호를
                입력해 주세요.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form action={action} noValidate className="flex flex-col gap-4">
              <FormField
                label="현재 비밀번호"
                type="password"
                autoComplete="current-password"
                error={errors.current}
                {...register("current")}
              />
              <FormResult status={state.status} message={state.message} />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>그만두기</AlertDialogCancel>
                <Button type="submit" variant="destructive" disabled={pending} aria-busy={pending}>
                  {pending ? "탈퇴하는 중…" : "탈퇴하기"}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AccountCard>
  );
}
