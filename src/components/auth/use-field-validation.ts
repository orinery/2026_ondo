"use client";

import { useState } from "react";
import type { z } from "zod";

import type { AuthField, AuthFormState } from "@/lib/validation/auth";

/**
 * blur 시점 인라인 검증 (명세 4.5: "인라인 유효성(blur 시점)")
 * - 칸을 벗어날 때 그 칸만 검사한다. 입력 중에는 방해하지 않는다.
 * - 이미 에러가 난 칸은 고치는 즉시 다시 검사해 에러를 지운다.
 * - 서버가 돌려준 에러(state.fieldErrors)가 바뀌면 그것으로 덮어쓴다.
 */
export function useFieldValidation(schema: z.ZodObject, state: AuthFormState) {
  const [errors, setErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [prevState, setPrevState] = useState(state);

  // 새 서버 응답이 오면 그 에러를 반영 (렌더 중 state 조정 패턴)
  if (state !== prevState) {
    setPrevState(state);
    setErrors(state.fieldErrors ?? {});
  }

  const validate = (field: AuthField, value: string) => {
    const fieldSchema = schema.shape[field];
    if (!fieldSchema) return;
    const result = fieldSchema.safeParse(value);
    setErrors((prev) => ({
      ...prev,
      [field]: result.success ? undefined : result.error.issues[0]?.message,
    }));
  };

  /** input에 펼쳐 쓰는 핸들러 */
  const register = (field: AuthField) => ({
    name: field,
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => validate(field, e.target.value),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (errors[field]) validate(field, e.target.value);
    },
  });

  return { errors, register, validate };
}
