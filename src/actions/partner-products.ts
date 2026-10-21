"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, knownErrorCode } from "@/lib/order-errors";
import { sqlNull } from "@/lib/sql-null";
import { createClient } from "@/lib/supabase/server";
import { inventoryRangeSchema, productFormSchema } from "@/lib/validation/product";

/**
 * 파트너 상품·재고 Server Actions.
 * 저장은 DB 함수 save_product 하나(= 한 트랜잭션)로 한다: 상품·사진·일정·회차·옵션이 함께 저장되거나 전부 안 된다.
 * 내 상품인지는 RLS(partner_id = my_partner_id())가, 쓸 수 있는 컬럼은 GRANT가 정한다 — 여기서는 검증·변환만.
 */

async function partnerGuard(): Promise<ActionResult<never> | null> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  if (user.role !== "partner" || user.partner?.status !== "active") {
    return { ok: false, reason: "invalid", message: errorMessage("forbidden") };
  }
  return null;
}

function dbFailure(error: { message: string; code?: string }): ActionResult<never> {
  // 상품 주소(slug) 중복 — unique 제약 위반
  if (error.code === "23505") {
    return {
      ok: false,
      reason: "invalid",
      message: "이미 쓰고 있는 상품 주소예요. 다른 주소를 입력해 주세요.",
    };
  }
  const code = knownErrorCode(error.message);
  return { ok: false, reason: code ? "invalid" : "error", message: errorMessage(code) };
}

export async function saveProduct(
  productId: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const denied = await partnerGuard();
  if (denied) return denied;
  if (productId !== null && !z.uuid().safeParse(productId).success) {
    return { ok: false, reason: "invalid" };
  }
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      reason: "invalid",
      message: issue ? `${issue.path.join(".")}: ${issue.message}` : undefined,
    };
  }
  const v = parsed.data;

  const supabase = await createClient();
  // DB 컬럼 이름으로 바꿔 넘긴다 (save_product가 jsonb_populate_record로 products 행 모양으로 읽는다)
  const { data, error } = await supabase.rpc("save_product", {
    p_product_id: sqlNull(productId),
    p_product: {
      slug: v.slug,
      city_id: v.cityId,
      category: v.category,
      theme: v.theme,
      title: v.title,
      summary: v.summary,
      description: v.description,
      highlights: v.highlights,
      adult_price: v.adultPrice,
      child_price: v.childPrice,
      list_adult_price: v.listAdultPrice,
      operating_days: [...v.operatingDays].sort(),
      cutoff_days: v.cutoffDays,
      max_qty: v.maxQty,
      duration_text: v.durationText,
      includes: v.includes,
      excludes: v.excludes,
      usage_info: v.usageInfo,
      meeting_point: v.meetingPoint,
      latitude: v.latitude,
      longitude: v.longitude,
      cancel_policy: v.cancelPolicy,
      unavailable_reason: v.unavailableReason || null,
      confirmation_mode: v.confirmationMode,
      publish: v.publish,
    },
    p_images: v.images,
    p_itinerary: v.itinerary.map((i) => ({
      time: i.time,
      title: i.title,
      note: i.note,
      type: i.type,
      caution: i.caution,
    })),
    p_slots: v.slots.map((s) => ({ start_time: s.startTime, capacity: s.capacity })),
    p_options: v.options,
  });
  if (error) return dbFailure(error);

  revalidatePath("/partner", "layout");
  revalidatePath(`/products/${v.slug}`);
  revalidatePath("/products");
  return { ok: true, id: data };
}

export async function setInventoryRange(input: unknown): Promise<ActionResult<{ days: number }>> {
  const denied = await partnerGuard();
  if (denied) return denied;
  const parsed = inventoryRangeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message };
  }
  const v = parsed.data;
  const reset = v.mode === "reset";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_inventory_range", {
    p_slot_id: v.slotId,
    p_from: v.from,
    p_to: v.to,
    p_weekdays: v.weekdays,
    // "기본값으로" = 덮어쓴 값을 모두 비운다
    p_capacity: sqlNull(reset ? null : v.capacity),
    p_closed: reset ? false : v.closed,
    p_adult_price: sqlNull(reset ? null : v.adultPrice),
    p_child_price: sqlNull(reset ? null : v.childPrice),
  });
  if (error) return dbFailure(error);

  revalidatePath("/partner", "layout");
  revalidatePath("/products", "layout");
  return { ok: true, days: data };
}
