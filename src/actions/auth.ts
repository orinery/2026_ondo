"use server";

import type { AuthError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  signupSchema,
  toFieldErrors,
  type AuthFormState,
} from "@/lib/validation/auth";

/**
 * Supabase 에러 코드를 사용자에게 보여줄 한국어 문구로 바꾼다.
 * 로그인 실패는 "이메일이 없는지 / 비밀번호가 틀렸는지"를 구분하지 않는다
 * — 구분해 주면 가입된 이메일을 알아내는 데 악용될 수 있다.
 */
function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "이메일 또는 비밀번호가 맞지 않아요";
    case "email_not_confirmed":
      return "이메일 인증이 아직 끝나지 않았어요. 받은 메일의 링크를 눌러 주세요";
    case "user_already_exists":
    case "email_exists":
      return "이미 가입된 이메일이에요. 로그인해 주세요";
    case "weak_password":
      return "더 안전한 비밀번호를 사용해 주세요";
    case "over_email_send_rate_limit":
      return "인증 메일 발송 한도를 넘었어요. 잠시 후 다시 시도해 주세요";
    case "over_request_rate_limit":
      return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요";
    default:
      return "잠시 문제가 생겼어요. 다시 시도해 주세요";
  }
}

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
};

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: str(formData, "email") };
  const parsed = loginSchema.safeParse({
    email: values.email,
    password: str(formData, "password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: authErrorMessage(error), values };

  // 로그인한 사람의 화면(나의 여행 등)을 새로 그리게 한다. 공개 페이지는 사람과 무관하게 캐시되므로 두고(S2),
  // 내비는 이동 뒤 브라우저가 /api/me로 다시 불러온다. (Server Action의 revalidatePath는 브라우저 라우터 캐시도 비운다)
  revalidatePath("/my", "layout");
  // redirect()는 내부적으로 예외를 던져 이동시키므로 try/catch 밖에서 호출해야 한다
  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { name: str(formData, "name"), email: str(formData, "email") };
  const parsed = signupSchema.safeParse({
    ...values,
    password: str(formData, "password"),
    terms: str(formData, "terms"),
    privacy: str(formData, "privacy"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  }

  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // user_metadata → DB 트리거(handle_new_user)가 profiles.display_name, terms_agreed_at에 반영
      // (두 동의 모두 필수라 terms_agreed_at = 둘 다 동의한 시각. privacy_agreed는 메타데이터에 함께 남긴다)
      data: { name: parsed.data.name, terms_agreed: true, privacy_agreed: true },
      // 인증 메일의 링크를 누르면 이 주소로 돌아와 세션을 만든다 (Supabase Redirect URLs에 등록 필요)
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { status: "error", message: authErrorMessage(error), values };

  // 이메일 인증을 끈 프로젝트면 바로 세션이 생긴다 → 곧장 이동
  if (data.session) {
    revalidatePath("/my", "layout");
    redirect(next);
  }

  // 인증을 켠 프로젝트(기본값) → 메일 확인 안내
  return { status: "check-email", values };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/my", "layout");
  redirect("/");
}
