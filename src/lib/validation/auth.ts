import { z } from "zod";

/**
 * 로그인·회원가입 입력 검증. 서버(Server Action)와 클라이언트(blur 시 인라인 검증)가 같은 스키마를 쓴다.
 * 클라이언트 검증은 사용자 경험용이고, 신뢰할 수 있는 검증은 항상 서버에서 다시 한다.
 */
const email = z
  .string()
  .trim()
  .min(1, "이메일을 입력해 주세요")
  .pipe(z.email("이메일 형식이 올바르지 않아요"));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
});

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력해 주세요")
    .max(30, "이름은 30자 이하로 입력해 주세요"),
  email,
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 해요")
    .max(72, "비밀번호는 72자 이하로 입력해 주세요") // bcrypt 입력 한계
    .regex(/[A-Za-z]/, "영문을 한 글자 이상 포함해 주세요")
    .regex(/[0-9]/, "숫자를 한 글자 이상 포함해 주세요"),
  // 체크박스는 체크 시 "on", 미체크 시 값이 없다. 약관과 개인정보 수집·이용은 따로 받는다 (A-04)
  terms: z.literal("on", { error: "이용약관에 동의해 주세요" }),
  privacy: z.literal("on", { error: "개인정보 수집·이용에 동의해 주세요" }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export type AuthField = "name" | "email" | "password" | "terms" | "privacy";

/** useActionState로 폼에 돌려주는 상태 */
export type AuthFormState = {
  status: "idle" | "error" | "check-email";
  message?: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
  // 실패 시 입력값 유지 (비밀번호는 보안상 돌려주지 않는다)
  values?: { name?: string; email?: string };
};

/** Zod 에러를 필드별 첫 메시지로 바꾼다 */
export function toFieldErrors(error: z.ZodError): Partial<Record<AuthField, string>> {
  const result: Partial<Record<AuthField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in result)) result[key as AuthField] = issue.message;
  }
  return result;
}
