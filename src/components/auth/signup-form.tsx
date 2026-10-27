"use client";

import { MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useId } from "react";

import { signUp } from "@/actions/auth";
import { Checkbox } from "@/components/ui/checkbox";
import { signupSchema, type AuthFormState } from "@/lib/validation/auth";

import { FormField } from "./form-field";
import { SocialButtons } from "./social-buttons";
import { SubmitButton } from "./submit-button";
import { useFieldValidation } from "./use-field-validation";

const INITIAL: AuthFormState = { status: "idle" };

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, INITIAL);
  const { errors, register, validate } = useFieldValidation(signupSchema, state);
  const termsId = useId();
  const privacyId = useId();

  // 가입 성공 + 이메일 인증이 필요한 경우 → 안내 화면 (empty/완료 상태)
  if (state.status === "check-email") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-accent">
          <MailCheckIcon aria-hidden className="size-6 text-accent-foreground" />
        </div>
        <h2 className="font-kr text-2xl font-semibold">인증 메일을 보냈어요</h2>
        <p className="text-muted-foreground">
          <strong className="font-semibold text-foreground">{state.values?.email}</strong>
          <br />
          메일의 링크를 누르면 가입이 완료돼요.
        </p>
        <p className="text-sm text-muted-foreground">메일이 안 보이면 스팸함을 확인해 주세요.</p>
        <Link href="/login" className="mt-2 text-sm font-semibold text-primary hover:underline">
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={action} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <FormField
          label="이름"
          autoComplete="name"
          defaultValue={state.values?.name}
          error={errors.name}
          {...register("name")}
        />
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
          autoComplete="new-password"
          hint="8자 이상, 영문과 숫자를 함께 써 주세요"
          error={errors.password}
          {...register("password")}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">약관 동의</legend>
          <ConsentCheckbox
            id={termsId}
            name="terms"
            error={errors.terms}
            onChecked={(on) => validate("terms", on ? "on" : "")}
          >
            <span className="font-semibold">(필수)</span>{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-2">
              이용약관
            </Link>
            에 동의합니다
          </ConsentCheckbox>
          <ConsentCheckbox
            id={privacyId}
            name="privacy"
            error={errors.privacy}
            onChecked={(on) => validate("privacy", on ? "on" : "")}
          >
            <span className="font-semibold">(필수)</span>{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-2">
              개인정보 수집·이용
            </Link>
            에 동의합니다 (이름·이메일, 회원 관리 목적, 탈퇴 시까지)
          </ConsentCheckbox>
        </fieldset>

        {state.status === "error" && state.message && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        <SubmitButton pending={pending} pendingLabel="가입하는 중…">
          회원가입
        </SubmitButton>
      </form>

      <SocialButtons />

      <p className="text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}

/** 필수 동의 체크박스 한 줄 — 체크하면 에러를 바로 지운다 */
function ConsentCheckbox({
  id,
  name,
  error,
  onChecked,
  children,
}: {
  id: string;
  name: string;
  error?: string;
  onChecked: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          name={name}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onCheckedChange={(checked) => onChecked(checked === true)}
          className="mt-0.5 size-5"
        />
        <label htmlFor={id} className="text-sm leading-6">
          {children}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
