"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, knownErrorCode } from "@/lib/order-errors";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자: 월 정산 완료 처리 (모의 — 실제 송금 없음).
 * 관리자인지, 끝난 달인지, 이미 처리했는지는 DB 함수 admin_settle_month가 판단한다.
 */
export async function settleMonth(
  partnerId: string,
  month: string,
): Promise<ActionResult<{ payout: number }>> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!z.uuid().safeParse(partnerId).success || !z.iso.date().safeParse(month).success) {
    return { ok: false, reason: "invalid" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_settle_month", {
    p_partner: partnerId,
    p_month: month,
  });
  if (error) {
    const code = knownErrorCode(error.message);
    return { ok: false, reason: code ? "invalid" : "error", message: errorMessage(code) };
  }

  revalidatePath("/admin/settlements");
  revalidatePath("/partner/settlements");
  return { ok: true, payout: data };
}
