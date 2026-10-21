"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, knownErrorCode } from "@/lib/order-errors";
import { createClient } from "@/lib/supabase/server";
import {
  partnerApplicationSchema,
  rejectReasonSchema,
  type PartnerApplicationField,
} from "@/lib/validation/partner";

/**
 * 파트너 신청(회원) · 승인/거절/정지(관리자) Server Actions.
 * 실제 규칙은 DB가 지킨다: 신청 중복·이미 파트너는 트리거가, 관리자 여부는 함수 안의 is_admin()이 확인한다.
 * 여기서는 로그인 확인 · 입력 검증 · 오류 코드 → 문장 변환만 한다.
 */

export type ApplicationFormState = {
  ok: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<PartnerApplicationField, string>>;
};

const FIELDS: PartnerApplicationField[] = [
  "businessName",
  "contactName",
  "contactPhone",
  "contactEmail",
  "intro",
];
const isField = (key: unknown): key is PartnerApplicationField =>
  FIELDS.some((field) => field === key);

export async function submitPartnerApplication(
  _prev: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  if (!(await getCurrentUser())) return { ok: false, error: "로그인이 필요해요." };

  const parsed = partnerApplicationSchema.safeParse(
    Object.fromEntries(FIELDS.map((field) => [field, formData.get(field) ?? ""])),
  );
  if (!parsed.success) {
    const fieldErrors: ApplicationFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (isField(key) && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "입력한 내용을 확인해 주세요.", fieldErrors };
  }

  const input = parsed.data;
  const supabase = await createClient();
  // user_id는 기본값(auth.uid())으로 채워진다 — 클라이언트가 보낼 수 없다(컬럼 권한 없음)
  const { error } = await supabase.from("partner_applications").insert({
    business_name: input.businessName,
    contact_name: input.contactName,
    contact_phone: input.contactPhone,
    contact_email: input.contactEmail,
    intro: input.intro,
  });
  if (error) return { ok: false, error: errorMessage(knownErrorCode(error.message)) };

  revalidatePath("/partner-apply");
  revalidatePath("/admin/partners");
  return { ok: true, error: null };
}

/** 관리자 함수 공통: 오류 코드를 문장으로. not_found는 화면마다 대상이 달라 여기서 문장을 정한다 */
function adminFailure(message: string | undefined, notFoundText: string) {
  const code = knownErrorCode(message);
  if (message?.trim() === "not_found")
    return { ok: false, reason: "invalid", message: notFoundText } as const;
  return { ok: false, reason: code ? "invalid" : "error", message: errorMessage(code) } as const;
}

export async function approveApplication(applicationId: string): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!z.uuid().safeParse(applicationId).success) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_partner_application", {
    p_application_id: applicationId,
  });
  if (error) return adminFailure(error.message, "신청서를 찾을 수 없어요.");

  revalidatePath("/admin/partners");
  return { ok: true };
}

export async function rejectApplication(
  applicationId: string,
  reason: string,
): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsedReason = rejectReasonSchema.safeParse(reason);
  if (!z.uuid().safeParse(applicationId).success || !parsedReason.success) {
    return {
      ok: false,
      reason: "invalid",
      message: parsedReason.error?.issues[0]?.message ?? "입력한 내용을 확인해 주세요.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_partner_application", {
    p_application_id: applicationId,
    p_reason: parsedReason.data,
  });
  if (error) return adminFailure(error.message, "신청서를 찾을 수 없어요.");

  revalidatePath("/admin/partners");
  return { ok: true };
}

export async function setPartnerStatus(
  partnerId: string,
  status: "active" | "suspended",
): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (
    !z.uuid().safeParse(partnerId).success ||
    !z.enum(["active", "suspended"]).safeParse(status).success
  ) {
    return { ok: false, reason: "invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_partner_status", {
    p_partner_id: partnerId,
    p_status: status,
  });
  if (error) return adminFailure(error.message, "파트너를 찾을 수 없어요.");

  revalidatePath("/admin/partners");
  return { ok: true };
}
