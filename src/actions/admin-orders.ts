"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { OPERATOR_CANCEL_CODES } from "@/lib/operator-cancel";
import { errorMessage, knownErrorCode } from "@/lib/order-errors";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자 주문 처리 Server Actions — 운영자 취소, 환불 조정, CS 메모.
 * 관리자인지는 DB 함수·RLS가 is_admin()으로 다시 확인한다.
 */

function failure(message: string | undefined): ActionResult<never> {
  if (message?.trim() === "not_found")
    return { ok: false, reason: "invalid", message: "주문 항목을 찾을 수 없어요." };
  const code = knownErrorCode(message);
  return { ok: false, reason: code ? "invalid" : "error", message: errorMessage(code) };
}

// 주문 상세(관리자·고객), 고객 예약 내역, 파트너 예약·정산이 함께 바뀐다
function revalidateOrder(orderNo: string) {
  revalidatePath(`/admin/orders/${orderNo}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/settlements");
  revalidatePath("/my", "layout");
  revalidatePath("/partner", "layout");
}

const orderNoSchema = z.string().regex(/^YO\d{6}-\d{6,}$/);
const textSchema = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label}을 입력해 주세요`)
    .max(max, `${label}은 ${max}자까지 쓸 수 있어요`);

export async function cancelItemAsOperator(input: {
  orderNo: string;
  itemId: string;
  reasonCode: string;
  note: string;
}): Promise<ActionResult<{ refund: number }>> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = z
    .object({
      orderNo: orderNoSchema,
      itemId: z.uuid(),
      reasonCode: z.enum(OPERATOR_CANCEL_CODES, "취소 사유를 골라 주세요"),
      note: textSchema("고객 안내", 200),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_cancel_item", {
    p_item_id: parsed.data.itemId,
    p_reason_code: parsed.data.reasonCode,
    p_note: parsed.data.note,
  });
  if (error) return failure(error.message);

  revalidateOrder(parsed.data.orderNo);
  return { ok: true, refund: data };
}

export async function adjustRefund(input: {
  orderNo: string;
  itemId: string;
  amount: number;
  reason: string;
}): Promise<ActionResult<{ refund: number }>> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = z
    .object({
      orderNo: orderNoSchema,
      itemId: z.uuid(),
      amount: z.number("새 환불액을 입력해 주세요").int().positive("새 환불액을 입력해 주세요"),
      reason: textSchema("조정 사유", 200),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_adjust_refund", {
    p_item_id: parsed.data.itemId,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  });
  if (error) return failure(error.message);

  revalidateOrder(parsed.data.orderNo);
  return { ok: true, refund: data };
}

export async function addOrderMemo(input: {
  orderNo: string;
  orderId: string;
  body: string;
}): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = z
    .object({ orderNo: orderNoSchema, orderId: z.uuid(), body: textSchema("메모", 500) })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("order_memos")
    .insert({ order_id: parsed.data.orderId, body: parsed.data.body });
  // 관리자가 아니면 RLS(with check)가 막는다
  if (error) return { ok: false, reason: "error", message: "메모를 남기지 못했어요." };

  revalidatePath(`/admin/orders/${parsed.data.orderNo}`);
  return { ok: true };
}
