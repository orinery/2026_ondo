"use client";

import { useActionState } from "react";

import { updateProfile } from "@/actions/account";
import { FormField } from "@/components/auth/form-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { useFieldValidation } from "@/components/auth/use-field-validation";
import { useViewer } from "@/components/viewer/viewer-provider";
import { profileSchema, type AuthFormState } from "@/lib/validation/auth";

import { AccountCard, FormResult } from "./account-card";

const INITIAL: AuthFormState = { status: "idle" };

/** 회원 정보 — 이메일(로그인 아이디, 읽기 전용) + 이름 수정 */
export function ProfileForm({ email, name }: { email: string; name: string }) {
  const { refresh } = useViewer();
  // 저장에 성공하면 내비의 이름도 바꾼다 (내비는 /api/me 값을 쓴다)
  const [state, action, pending] = useActionState(
    async (prev: AuthFormState, formData: FormData) => {
      const result = await updateProfile(prev, formData);
      if (result.status === "success") refresh();
      return result;
    },
    INITIAL,
  );
  const { errors, register } = useFieldValidation(profileSchema, state);

  return (
    <AccountCard id="profile-title" title="회원 정보">
      <dl className="flex flex-col gap-1">
        <dt className="text-sm font-medium">이메일 (로그인 아이디)</dt>
        <dd className="text-base">{email}</dd>
        <dd className="text-sm text-muted-foreground">이메일은 바꿀 수 없어요.</dd>
      </dl>
      <form action={action} noValidate className="flex flex-col gap-4">
        <FormField
          label="이름"
          autoComplete="name"
          maxLength={30}
          defaultValue={state.values?.name ?? name}
          hint="리뷰와 예약자 정보 기본값에 쓰여요"
          error={errors.name}
          {...register("name")}
        />
        <FormResult status={state.status} message={state.message} />
        <div className="flex justify-end">
          <SubmitButton pending={pending} pendingLabel="저장하는 중…">
            이름 저장
          </SubmitButton>
        </div>
      </form>
    </AccountCard>
  );
}
