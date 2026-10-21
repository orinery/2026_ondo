"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, knownErrorCode } from "@/lib/order-errors";
import { sqlNull } from "@/lib/sql-null";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자 콘솔 Server Actions — 상품 판매 중지/재개, 리뷰 신고 처리, 리뷰 숨김 해제.
 * 관리자인지는 각 DB 함수가 is_admin()으로 다시 확인한다.
 */

function failure(message: string | undefined, notFoundText: string): ActionResult<never> {
  if (message?.trim() === "not_found")
    return { ok: false, reason: "invalid", message: notFoundText };
  const code = knownErrorCode(message);
  return { ok: false, reason: code ? "invalid" : "error", message: errorMessage(code) };
}

export async function setProductSuspension(
  productId: string,
  reason: string | null,
): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsedReason = z
    .string()
    .trim()
    .min(1, "중지 사유를 입력해 주세요")
    .max(100)
    .nullable()
    .safeParse(reason);
  if (!z.uuid().safeParse(productId).success || !parsedReason.success) {
    return { ok: false, reason: "invalid", message: parsedReason.error?.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_product_suspension", {
    p_product_id: productId,
    p_reason: sqlNull(parsedReason.data),
  });
  if (error) return failure(error.message, "상품을 찾을 수 없어요.");

  // 상품 목록·상세·파트너 화면 모두 판매 상태가 바뀐다
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resolveReport(
  reportId: string,
  action: "dismiss" | "hide",
): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (
    !z.uuid().safeParse(reportId).success ||
    !z.enum(["dismiss", "hide"]).safeParse(action).success
  ) {
    return { ok: false, reason: "invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_review_report", {
    p_report_id: reportId,
    p_action: action,
  });
  if (error) return failure(error.message, "신고를 찾을 수 없어요.");

  // 숨기면 상품 상세의 리뷰·평점이 바뀐다
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setReviewHidden(reviewId: string, hidden: boolean): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!z.uuid().safeParse(reviewId).success) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_review_hidden", {
    p_review_id: reviewId,
    p_hidden: hidden,
  });
  if (error) return failure(error.message, "리뷰를 찾을 수 없어요.");

  revalidatePath("/", "layout");
  return { ok: true };
}
