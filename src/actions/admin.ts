"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, knownErrorCode } from "@/lib/order-errors";
import { sqlNull } from "@/lib/sql-null";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자 콘솔 Server Actions — 상품 판매 중지/재개(+ 영향 미리보기), 리뷰 신고 처리, 리뷰 숨김 해제.
 * 사람·상품에 영향을 주는 조치는 모두 사유를 받아 감사 로그에 남긴다.
 * 관리자인지는 각 DB 함수가 is_admin()으로 다시 확인한다.
 */

function failure(message: string | undefined, notFoundText: string): ActionResult<never> {
  if (message?.trim() === "not_found")
    return { ok: false, reason: "invalid", message: notFoundText };
  const code = knownErrorCode(message);
  return { ok: false, reason: code ? "invalid" : "error", message: errorMessage(code) };
}

const reasonSchema = (max: number) =>
  z.string().trim().min(1, "사유를 입력해 주세요").max(max, `사유는 ${max}자까지 쓸 수 있어요`);

/**
 * 상품 판매 중지 / 재개 — 사유는 둘 다 필수 (감사 로그).
 * 중지 종류: info_fix(정보 수정 필요 — 신규 판매만) · unsafe(운영 불가·위험 — 이용 전 예약도 전액 환불 취소)
 */
export async function setProductSuspension(
  productId: string,
  input: { suspend: boolean; kind: "info_fix" | "unsafe" | null; reason: string },
): Promise<ActionResult<{ cancelled: number }>> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = z
    .object({
      productId: z.uuid(),
      suspend: z.boolean(),
      kind: z.enum(["info_fix", "unsafe"]).nullable(),
      reason: reasonSchema(100),
    })
    .refine((v) => !v.suspend || v.kind !== null, "중지 종류를 골라 주세요")
    .safeParse({ productId, ...input });
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_product_suspension", {
    p_product_id: parsed.data.productId,
    p_suspend: parsed.data.suspend,
    p_kind: sqlNull(parsed.data.kind),
    p_reason: parsed.data.reason,
  });
  if (error) return failure(error.message, "상품을 찾을 수 없어요.");

  // 상품 목록·상세·파트너 화면, (운영 불가면) 주문·정산까지 바뀐다
  revalidatePath("/", "layout");
  return { ok: true, cancelled: data };
}

export type ProductImpact = { pending: number; confirmed: number; refundTotal: number };

/** 판매 중지 확인 창: 이용 전 예약 수와 전액 환불 시 금액 ("운영 불가"로 중지하면 취소될 범위) */
export async function getProductImpact(
  productId: string,
): Promise<ActionResult<{ impact: ProductImpact }>> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!z.uuid().safeParse(productId).success) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_product_impact", { p_product_id: productId });
  if (error) return failure(error.message, "상품을 찾을 수 없어요.");
  const row = data[0];
  return {
    ok: true,
    impact: {
      pending: row?.pending_count ?? 0,
      confirmed: row?.confirmed_count ?? 0,
      refundTotal: row?.refund_total ?? 0,
    },
  };
}

export async function resolveReport(
  reportId: string,
  action: "dismiss" | "hide",
  note: string,
): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = z
    .object({ reportId: z.uuid(), action: z.enum(["dismiss", "hide"]), note: reasonSchema(200) })
    .safeParse({ reportId, action, note });
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_review_report", {
    p_report_id: parsed.data.reportId,
    p_action: parsed.data.action,
    p_note: parsed.data.note,
  });
  if (error) return failure(error.message, "신고를 찾을 수 없어요.");

  // 숨기면 상품 상세의 리뷰·평점이 바뀐다
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setReviewHidden(
  reviewId: string,
  hidden: boolean,
  reason: string,
): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = z
    .object({ reviewId: z.uuid(), reason: reasonSchema(200) })
    .safeParse({ reviewId, reason });
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_review_hidden", {
    p_review_id: parsed.data.reviewId,
    p_hidden: hidden,
    p_reason: parsed.data.reason,
  });
  if (error) return failure(error.message, "리뷰를 찾을 수 없어요.");

  revalidatePath("/", "layout");
  return { ok: true };
}
