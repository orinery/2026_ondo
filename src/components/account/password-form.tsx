"use client";

import { useActionState } from "react";

import { changePassword } from "@/actions/account";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { useFieldValidation } from "@/components/auth/use-field-validation";
import { passwordChangeSchema, type AuthFormState } from "@/lib/validation/auth";

import { AccountCard, FormResult } from "./account-card";

const INITIAL: AuthFormState = { status: "idle" };

/**
 * 비밀번호 변경 — 현재 비밀번호로 본인을 다시 확인한다.
 * 저장하면 React 19 폼 액션이 입력을 비운다 (비밀번호는 다시 채우지 않는다).
 */
export function PasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(changePassword, INITIAL);
  const { errors, register } = useFieldValidation(passwordChangeSchema, state);

  return (
    <AccountCard
      id="password-title"
      title="비밀번호 변경"
      description="8자 이상, 영문과 숫자를 함께 써 주세요."
    >
      <form action={action} noValidate className="flex flex-col gap-4">
        {/* 비밀번호 관리자가 어느 계정의 비밀번호인지 알 수 있게 아이디를 함께 둔다 */}
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
        <FormField
          label="현재 비밀번호"
          type="password"
          autoComplete="current-password"
          error={errors.current}
          {...register("current")}
        />
        <FormField
          label="새 비밀번호"
          type="password"
          autoComplete="new-password"
          error={errors.password}
          {...register("password")}
        />
        <FormField
          label="새 비밀번호 확인"
          type="password"
          autoComplete="new-password"
          error={errors.confirm}
          {...register("confirm")}
        />
        <FormResult status={state.status} message={state.message} />
        <div className="flex justify-end">
          <SubmitButton pending={pending} pendingLabel="바꾸는 중…">
            비밀번호 변경
          </SubmitButton>
        </div>
      </form>
    </AccountCard>
  );
}
