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

// 이름·비밀번호 규칙은 가입과 계정 설정(이름 수정·비밀번호 변경)이 같이 쓴다
const name = z
  .string()
  .trim()
  .min(1, "이름을 입력해 주세요")
  .max(30, "이름은 30자 이하로 입력해 주세요");
const newPassword = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 해요")
  .max(72, "비밀번호는 72자 이하로 입력해 주세요") // bcrypt 입력 한계
  .regex(/[A-Za-z]/, "영문을 한 글자 이상 포함해 주세요")
  .regex(/[0-9]/, "숫자를 한 글자 이상 포함해 주세요");
const currentPassword = z.string().min(1, "현재 비밀번호를 입력해 주세요");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
});

export const signupSchema = z.object({
  name,
  email,
  password: newPassword,
  // 체크박스는 체크 시 "on", 미체크 시 값이 없다. 약관과 개인정보 수집·이용은 따로 받는다 (A-04)
  terms: z.literal("on", { error: "이용약관에 동의해 주세요" }),
  privacy: z.literal("on", { error: "개인정보 수집·이용에 동의해 주세요" }),
});

/** 계정 설정 > 회원 정보 */
export const profileSchema = z.object({ name });

/** 계정 설정 > 비밀번호 변경 — 현재 비밀번호로 본인을 다시 확인한다 */
export const passwordChangeSchema = z
  .object({ current: currentPassword, password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "새 비밀번호가 서로 달라요",
  })
  .refine((v) => v.password !== v.current, {
    path: ["password"],
    message: "지금과 다른 비밀번호를 입력해 주세요",
  });

/** 계정 설정 > 회원 탈퇴 — 현재 비밀번호로 본인을 다시 확인한다 */
export const deleteAccountSchema = z.object({ current: currentPassword });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// current·confirm: 계정 설정의 현재 비밀번호·새 비밀번호 확인
export type AuthField = "name" | "email" | "password" | "terms" | "privacy" | "current" | "confirm";

/** useActionState로 폼에 돌려주는 상태 */
export type AuthFormState = {
  status: "idle" | "error" | "check-email" | "success"; // success: 계정 설정에서 저장 완료
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
