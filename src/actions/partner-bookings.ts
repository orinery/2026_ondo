"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, knownErrorCode } from "@/lib/order-errors";
import { createClient } from "@/lib/supabase/server";
import { rejectReasonSchema } from "@/lib/validation/partner";

/**
 * 파트너 예약 처리 Server Actions — 확정 · 거절 · 바우처 사용 처리.
 * 내 상품 예약인지, 상태가 맞는지, 기한이 지났는지는 DB 함수가 주문 행을 잠근 뒤 판단한다.
 */

function failure(message: string | undefined): ActionResult<never> {
  const code = knownErrorCode(message);
  if (message?.trim() === "not_found") {
    return { ok: false, reason: "invalid", message: "예약을 찾을 수 없어요." };
  }
  return { ok: false, reason: code ? "invalid" : "error", message: errorMessage(code) };
}

// 파트너 화면·고객 예약 상세(상태·바우처)가 함께 바뀐다
const refresh = () => revalidatePath("/", "layout");

/** 확정 — 기한이 지났으면 확정 대신 자동 취소되고 "expired"를 돌려준다 */
export async function confirmBooking(
  itemId: string,
): Promise<ActionResult<{ result: "confirmed" | "expired" }>> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!z.uuid().safeParse(itemId).success) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_item", { p_item_id: itemId });
  if (error) return failure(error.message);
  refresh();
  return { ok: true, result: data === "expired" ? "expired" : "confirmed" };
}

/** 거절 — 전액 환불, 사유는 고객에게 보인다 */
export async function rejectBooking(itemId: string, reason: string): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsedReason = rejectReasonSchema.safeParse(reason);
  if (!z.uuid().safeParse(itemId).success || !parsedReason.success) {
    return {
      ok: false,
      reason: "invalid",
      message: parsedReason.error?.issues[0]?.message ?? "입력한 내용을 확인해 주세요.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_item", {
    p_item_id: itemId,
    p_reason: parsedReason.data,
  });
  if (error) return failure(error.message);
  refresh();
  return { ok: true };
}

export type VoucherState = {
  error: string | null;
  used: { productTitle: string; useDate: string; people: number; bookerName: string } | null;
};

/** 바우처 사용 처리 (코드 입력 폼 — useActionState) */
export async function markVoucherUsed(
  _prev: VoucherState,
  formData: FormData,
): Promise<VoucherState> {
  if (!(await getCurrentUser())) return { error: "로그인이 필요해요.", used: null };
  const code = String(formData.get("code") ?? "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
  if (code.length !== 10) return { error: "바우처 코드 10자리를 입력해 주세요.", used: null };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_used", { p_code: code });
  if (error) return { error: failure(error.message).message ?? errorMessage(null), used: null };
  const row = data[0];
  refresh();
  return {
    error: null,
    used: row
      ? {
          productTitle: row.product_title,
          useDate: row.use_date,
          people: row.people,
          bookerName: row.booker_name,
        }
      : null,
  };
}
