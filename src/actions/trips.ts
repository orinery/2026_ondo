"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tripDayCount } from "@/lib/trip-dates";
import { tripItemSchema, tripSchema, type TripInput } from "@/lib/validation/trip";

/**
 * 일정 플래너 Server Actions
 * 공통 흐름: 로그인 확인 → Zod 검증 → supabase-js(RLS: 본인 여행만) → /my 다시 그리기
 * user_id는 보내지 않는다(DB 기본값 auth.uid()). 항목은 상위 여행의 소유자로 권한을 판단한다.
 */

const uuid = z.uuid();
const refresh = () => revalidatePath("/my");

const invalid = (message?: string): ActionResult => ({ ok: false, reason: "invalid", message });
const failed: ActionResult = { ok: false, reason: "error" };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** 그날의 마지막 순서 다음 번호 — 새 항목은 그날 맨 끝에 붙는다 */
async function nextPosition(supabase: Supabase, tripId: string, dayIndex: number) {
  const { data } = await supabase
    .from("trip_items")
    .select("position")
    .eq("trip_id", tripId)
    .eq("day_index", dayIndex)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? -1) + 1;
}

/** dayIndex가 여행 기간 안인지 확인 (남의 여행이면 RLS 때문에 trip이 null) */
async function getTripDays(supabase: Supabase, tripId: string) {
  const { data } = await supabase
    .from("trips")
    .select("start_date, end_date")
    .eq("id", tripId)
    .maybeSingle();
  return data ? tripDayCount(data.start_date, data.end_date) : null;
}

// ─── 여행 ────────────────────────────────────────────────────────────────

export async function createTrip(input: TripInput): Promise<ActionResult<{ tripId: string }>> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .insert({
      title: parsed.data.title,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
    })
    .select("id")
    .single();
  if (error) return { ok: false, reason: "error" };
  refresh();
  return { ok: true, tripId: data.id };
}

export async function updateTrip(tripId: string, input: TripInput): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = tripSchema.safeParse(input);
  if (!uuid.safeParse(tripId).success || !parsed.success)
    return invalid(parsed.error?.issues[0]?.message);

  const supabase = await createClient();
  // 기간을 줄였을 때 사라지는 날에 일정이 있으면 막는다 (항목이 보이지 않는 날에 남지 않게)
  const newDays = tripDayCount(parsed.data.startDate, parsed.data.endDate);
  const { data: overflow } = await supabase
    .from("trip_items")
    .select("day_index")
    .eq("trip_id", tripId)
    .gte("day_index", newDays)
    .order("day_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (overflow) {
    return invalid(`Day ${overflow.day_index + 1}에 일정이 있어 기간을 그보다 짧게 줄일 수 없어요`);
  }

  const { error } = await supabase
    .from("trips")
    .update({
      title: parsed.data.title,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
    })
    .eq("id", tripId);
  if (error) return failed;
  refresh();
  return { ok: true };
}

export async function deleteTrip(tripId: string): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!uuid.safeParse(tripId).success) return invalid();

  const supabase = await createClient();
  // 항목은 FK on delete cascade로 함께 지워진다
  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  if (error) return failed;
  refresh();
  return { ok: true };
}

// ─── 일정 항목 ────────────────────────────────────────────────────────────

/** 자유 장소 추가 ("+ 장소 추가") */
export async function addTripItem(tripId: string, input: unknown): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = tripItemSchema.safeParse(input);
  if (!uuid.safeParse(tripId).success || !parsed.success)
    return invalid(parsed.error?.issues[0]?.message);

  const supabase = await createClient();
  const days = await getTripDays(supabase, tripId);
  if (days === null || parsed.data.dayIndex >= days)
    return invalid("여행 기간 안의 날을 골라 주세요");

  const { error } = await supabase.from("trip_items").insert({
    trip_id: tripId,
    day_index: parsed.data.dayIndex,
    position: await nextPosition(supabase, tripId, parsed.data.dayIndex),
    title: parsed.data.title,
    time: parsed.data.time ?? null,
    type: parsed.data.type,
    note: parsed.data.note ?? null,
    caution: parsed.data.caution ?? null,
  });
  if (error) return failed;
  refresh();
  return { ok: true };
}

/**
 * 찜한 상품을 일정에 담는다 ("찜에서 불러오기").
 * 제목은 상품명, 유형은 관광으로 넣고, 상품과 연결되므로 만나는 장소가 동선 지도에 표시된다.
 * (구매한 상품은 주문할 때 place_order가 "예약" 항목으로 자동으로 넣는다)
 */
export async function addProductsToTrip(
  tripId: string,
  dayIndex: number,
  productIds: string[],
): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const ids = z.array(uuid).min(1).max(30).safeParse(productIds);
  const day = z.number().int().min(0).safeParse(dayIndex);
  if (!uuid.safeParse(tripId).success || !ids.success || !day.success) {
    return invalid("담을 상품을 골라 주세요");
  }

  const supabase = await createClient();
  const days = await getTripDays(supabase, tripId);
  if (days === null || day.data >= days) return invalid("여행 기간 안의 날을 골라 주세요");

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, title")
    .in("id", ids.data);
  if (productError || !products?.length) return invalid("상품을 찾을 수 없어요");

  // 요청한 순서를 유지한다
  const ordered = ids.data.flatMap((id) => products.filter((p) => p.id === id));
  const start = await nextPosition(supabase, tripId, day.data);
  const { error } = await supabase.from("trip_items").insert(
    ordered.map((d, i) => ({
      trip_id: tripId,
      day_index: day.data,
      position: start + i,
      title: d.title.slice(0, 60),
      type: "sight" as const,
      product_id: d.id,
    })),
  );
  if (error) return failed;
  refresh();
  return { ok: true };
}

/** 항목 수정 — 다른 날로 옮기면 그날의 맨 끝에 붙는다 (사용자 확정: 수정 창에서 날 변경) */
export async function updateTripItem(
  tripId: string,
  itemId: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = tripItemSchema.safeParse(input);
  if (!uuid.safeParse(tripId).success || !uuid.safeParse(itemId).success || !parsed.success) {
    return invalid(parsed.error?.issues[0]?.message);
  }

  const supabase = await createClient();
  const days = await getTripDays(supabase, tripId);
  if (days === null || parsed.data.dayIndex >= days)
    return invalid("여행 기간 안의 날을 골라 주세요");

  const { data: current } = await supabase
    .from("trip_items")
    .select("day_index")
    .eq("id", itemId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!current) return invalid("일정을 찾을 수 없어요");

  const movedDay = current.day_index !== parsed.data.dayIndex;
  const { error } = await supabase
    .from("trip_items")
    .update({
      title: parsed.data.title,
      day_index: parsed.data.dayIndex,
      time: parsed.data.time ?? null,
      type: parsed.data.type,
      note: parsed.data.note ?? null,
      caution: parsed.data.caution ?? null,
      ...(movedDay ? { position: await nextPosition(supabase, tripId, parsed.data.dayIndex) } : {}),
    })
    .eq("id", itemId);
  if (error) return failed;
  refresh();
  return { ok: true };
}

export async function removeTripItem(itemId: string): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!uuid.safeParse(itemId).success) return invalid();

  const supabase = await createClient();
  const { error } = await supabase.from("trip_items").delete().eq("id", itemId);
  if (error) return failed;
  refresh();
  return { ok: true };
}

/** 드래그 정렬 결과 저장 — DB 함수 하나로 원자적으로 처리 (0002 마이그레이션) */
export async function reorderTripItems(
  tripId: string,
  dayIndex: number,
  orderedItemIds: string[],
): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const ids = z.array(uuid).max(100).safeParse(orderedItemIds);
  if (!uuid.safeParse(tripId).success || !ids.success) return invalid();

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_trip_items", {
    p_trip_id: tripId,
    p_day_index: dayIndex,
    p_item_ids: ids.data,
  });
  if (error) return failed;
  refresh();
  return { ok: true };
}
