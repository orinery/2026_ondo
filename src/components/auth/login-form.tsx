"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn } from "@/actions/auth";
import { loginSchema, type AuthFormState } from "@/lib/validation/auth";

import { FormField } from "./form-field";
import { SocialButtons } from "./social-buttons";
import { SubmitButton } from "./submit-button";
import { useFieldValidation } from "./use-field-validation";

const INITIAL: AuthFormState = { status: "idle" };

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  // useActionState: Server Action의 반환값(에러 등)과 처리 중 여부를 함께 관리한다
  const [state, action, pending] = useActionState(signIn, INITIAL);
  const { errors, register } = useFieldValidation(loginSchema, state);

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <p role="status" className="rounded-md bg-accent px-4 py-3 text-sm text-accent-foreground">
          {notice}
        </p>
      )}

      {/* noValidate: 브라우저 기본 검증 대신 디자인에 맞춘 인라인 검증을 쓴다 */}
      <form action={action} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <FormField
          label="이메일"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.values?.email}
          error={errors.email}
          {...register("email")}
        />
        <FormField
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          error={errors.password}
          {...register("password")}
        />
        {state.status === "error" && state.message && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        <SubmitButton pending={pending} pendingLabel="로그인 중…">
          로그인
        </SubmitButton>
      </form>

      <SocialButtons />

      <p className="text-center text-sm text-muted-foreground">
        아직 회원이 아니신가요?{" "}
        <Link
          href={`/signup${next !== "/my" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-primary hover:underline"
        >
          회원가입
        </Link>
      </p>
    </div>
  );
}
