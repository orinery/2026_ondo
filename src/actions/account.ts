"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deletionBlockerMessage, knownBlocker } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/server";
import {
  deleteAccountSchema,
  passwordChangeSchema,
  profileSchema,
  toFieldErrors,
  type AuthFormState,
} from "@/lib/validation/auth";

/**
 * 계정 설정 (/my/account) — 이름 수정 · 비밀번호 변경 · 회원 탈퇴.
 * 메일을 보내는 기능(비밀번호 찾기·이메일 변경)은 두지 않는다 (사용자 확정: 기본 메일 발송 한도).
 */

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
};

const LOGIN_REQUIRED: AuthFormState = { status: "error", message: "로그인이 필요해요" };

/**
 * 현재 비밀번호 확인 — 같은 계정으로 다시 로그인해 본다.
 * 비밀번호 변경·탈퇴처럼 되돌리기 어려운 동작 앞에서 "자리를 비운 사이 남이 누른" 경우를 막는다.
 */
async function verifyPassword(email: string, password: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return null;
  return error.code === "invalid_credentials"
    ? "현재 비밀번호가 맞지 않아요"
    : authErrorMessage(error);
}

/** 이름 수정 — profiles.display_name (본인 행만 수정 가능: profiles_update_own 정책 + 컬럼 권한) */
export async function updateProfile(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  const values = { name: str(formData, "name") };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.name })
    .eq("id", user.id);
  if (error) return { status: "error", message: "이름을 저장하지 못했어요", values };

  revalidatePath("/my", "layout");
  return { status: "success", message: "이름을 바꿨어요", values };
}

/** 비밀번호 변경 — 현재 비밀번호 확인 → 새 비밀번호 저장 */
export async function changePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getCurrentUser();
  if (!user?.email) return LOGIN_REQUIRED;
  const parsed = passwordChangeSchema.safeParse({
    current: str(formData, "current"),
    password: str(formData, "password"),
    confirm: str(formData, "confirm"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error) };
  }

  const wrong = await verifyPassword(user.email, parsed.data.current);
  if (wrong) return { status: "error", fieldErrors: { current: wrong } };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: authErrorMessage(error) };
  return { status: "success", message: "비밀번호를 바꿨어요" };
}

/**
 * 회원 탈퇴 — 현재 비밀번호 확인 → 막는 사유 확인 → 리뷰 사진 삭제 → DB 함수로 계정 삭제 → 로그아웃.
 * 찜·일정·장바구니·리뷰는 함께 지워지고, 주문 기록은 법령 보관용으로 소유자 없이 남는다 (0030·0040).
 */
export async function deleteAccount(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getCurrentUser();
  if (!user?.email) return LOGIN_REQUIRED;
  const parsed = deleteAccountSchema.safeParse({ current: str(formData, "current") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error) };
  }

  const wrong = await verifyPassword(user.email, parsed.data.current);
  if (wrong) return { status: "error", fieldErrors: { current: wrong } };

  const supabase = await createClient();
  const { data: blocker, error: checkError } = await supabase.rpc("account_deletion_blocker");
  if (checkError) return { status: "error", message: deletionBlockerMessage("") };
  if (blocker) return { status: "error", message: deletionBlockerMessage(blocker) };

  // 리뷰 사진은 Storage에 있어 DB 연쇄 삭제로 지워지지 않는다 → 본인 폴더를 먼저 비운다 (Storage 정책: 본인 폴더만)
  const bucket = supabase.storage.from("review-photos");
  const { data: photos } = await bucket.list(user.id, { limit: 1000 });
  if (photos && photos.length > 0) {
    await bucket.remove(photos.map((p) => `${user.id}/${p.name}`));
  }

  // DB 함수가 막는 사유를 다시 확인한 뒤 auth.users 행을 지운다 (사이에 예약이 생겼어도 여기서 막힌다)
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    const code = knownBlocker(error.message);
    return { status: "error", message: deletionBlockerMessage(code ?? "") };
  }

  // 지운 계정의 세션 쿠키를 정리한다 (서버의 세션은 계정과 함께 이미 사라졌다)
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/my", "layout");
  redirect("/?notice=withdrawn");
}
