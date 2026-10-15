"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, knownErrorCode } from "@/lib/order-errors";
import { createClient } from "@/lib/supabase/server";
import { cartItemSchema, cartQuantitySchema } from "@/lib/validation/cart";

/**
 * 장바구니 Server Actions
 * - 로그인 확인 → Zod 검증 → supabase-js(RLS: 본인 장바구니만).
 * - 가격은 다루지 않는다. 장바구니에는 상품·이용일·인원만 저장하고, 금액은 결제 시 DB 함수가 계산한다.
 * - 예약 가능 여부(요일·마감·인원)는 DB 트리거(validate_cart_item)가 최종 판단한다.
 *   트리거가 던진 코드(예: "closed_day")를 사용자 문장으로 바꿔 돌려준다.
 */

const uuid = z.uuid();

// 장바구니 개수 배지(내비)와 장바구니·주문서가 바뀌므로 레이아웃 단위로 다시 그린다
const refresh = () => revalidatePath("/", "layout");

function dbFailure(message: string | undefined): ActionResult<never> {
  const code = knownErrorCode(message);
  return code
    ? { ok: false, reason: "invalid", message: errorMessage(code) }
    : { ok: false, reason: "error" };
}

/**
 * 장바구니 담기.
 * - mode "add"(장바구니 담기): 같은 상품·같은 날짜가 이미 있으면 인원을 더한다
 * - mode "set"(바로 구매): 인원을 이번 선택 그대로 맞춘다 — 예전에 담아 둔 인원이 섞여 결제되지 않게
 * 돌려주는 cartItemId로 바로 구매는 주문서(/checkout?items=)로 이동한다.
 */
export async function addToCart(
  input: unknown,
  mode: "add" | "set" = "add",
): Promise<ActionResult<{ cartItemId: string }>> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = cartItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message };
  }
  const { productId, useDate, adultQty, childQty } = parsed.data;

  const supabase = await createClient();
  const { data: existing, error: findError } = await supabase
    .from("cart_items")
    .select("id, adult_qty, child_qty")
    .eq("product_id", productId)
    .eq("use_date", useDate)
    .maybeSingle();
  if (findError) return { ok: false, reason: "error" };

  if (existing) {
    const next =
      mode === "add"
        ? { adult_qty: existing.adult_qty + adultQty, child_qty: existing.child_qty + childQty }
        : { adult_qty: adultQty, child_qty: childQty };
    const { error } = await supabase.from("cart_items").update(next).eq("id", existing.id);
    if (error) return dbFailure(error.message);
    refresh();
    return { ok: true, cartItemId: existing.id };
  }

  const { data, error } = await supabase
    .from("cart_items")
    .insert({ product_id: productId, use_date: useDate, adult_qty: adultQty, child_qty: childQty })
    .select("id")
    .single();
  if (error) return dbFailure(error.message);
  refresh();
  return { ok: true, cartItemId: data.id };
}

/** 장바구니에서 인원 바꾸기 */
export async function updateCartQuantity(
  cartItemId: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = cartQuantitySchema.safeParse(input);
  if (!uuid.safeParse(cartItemId).success || !parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error?.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cart_items")
    .update({ adult_qty: parsed.data.adultQty, child_qty: parsed.data.childQty })
    .eq("id", cartItemId);
  if (error) return dbFailure(error.message);
  refresh();
  return { ok: true };
}

/** 장바구니에서 빼기 (여러 개 한꺼번에) — 남의 항목 id는 RLS로 0행 */
export async function removeCartItems(cartItemIds: string[]): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const ids = z.array(uuid).min(1).max(50).safeParse(cartItemIds);
  if (!ids.success) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.from("cart_items").delete().in("id", ids.data);
  if (error) return { ok: false, reason: "error" };
  refresh();
  return { ok: true };
}
