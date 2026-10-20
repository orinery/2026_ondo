"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, knownErrorCode } from "@/lib/order-errors";
import { createClient } from "@/lib/supabase/server";
import { checkoutSchema } from "@/lib/validation/checkout";

/**
 * 주문·취소 Server Actions — 실제 작업은 DB 함수가 한다.
 * - place_order: 가격을 products에서 다시 계산하고, 화면 금액(expectedTotal)과 다르면 거부한다.
 *   중복 방지 키(idempotencyKey)가 같으면 같은 주문을 돌려준다 → 결제 버튼을 두 번 눌러도 주문은 하나.
 * - cancel_order: 본인 주문만, 이용일 전까지만, 취소 규정에 따라 환불액 계산.
 * 여기서는 로그인 확인 · 입력 검증 · 오류 코드 → 문장 변환만 한다.
 */

export type CheckoutState = {
  error: string | null;
  // price_changed·cart_changed: 화면을 새로 불러와야 해결되는 오류 → "다시 불러오기" 버튼을 보여준다
  needsRefresh?: boolean;
  fieldErrors?: Partial<
    Record<"bookerName" | "bookerEmail" | "bookerPhone" | "policyAgreed", string>
  >;
};

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  if (!(await getCurrentUser())) redirect("/login?next=%2Fcart");

  const parsed = checkoutSchema.safeParse({
    bookerName: formData.get("bookerName"),
    bookerEmail: formData.get("bookerEmail"),
    bookerPhone: formData.get("bookerPhone"),
    policyAgreed: formData.get("policyAgreed"),
    cartItemIds: formData.getAll("cartItemId"),
    expectedTotal: formData.get("expectedTotal"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    const fieldErrors: CheckoutState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (
        (key === "bookerName" ||
          key === "bookerEmail" ||
          key === "bookerPhone" ||
          key === "policyAgreed") &&
        !fieldErrors[key]
      ) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: "입력한 내용을 확인해 주세요.", fieldErrors };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const { data: orderNo, error } = await supabase.rpc("place_order", {
    p_cart_item_ids: input.cartItemIds,
    p_booker_name: input.bookerName,
    p_booker_email: input.bookerEmail,
    p_booker_phone: input.bookerPhone,
    p_policy_agreed: true,
    p_expected_total: input.expectedTotal,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    const code = knownErrorCode(error.message);
    return {
      error: errorMessage(code),
      // 동의 누락 외의 코드(가격 변경·장바구니 변경·예약 조건)는 화면을 새로 불러와야 해결된다
      needsRefresh: code !== null && code !== "policy_not_agreed",
    };
  }

  // 장바구니 배지·나의 여행(예약 내역·플래너)이 모두 바뀐다
  revalidatePath("/", "layout");
  redirect(`/checkout/complete/${orderNo}`);
}

export async function cancelOrder(orderId: string): Promise<ActionResult<{ refund: number }>> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!z.uuid().safeParse(orderId).success) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) {
    const code = knownErrorCode(error.message);
    return { ok: false, reason: code ? "invalid" : "error", message: errorMessage(code) };
  }

  revalidatePath("/", "layout");
  return { ok: true, refund: data };
}
