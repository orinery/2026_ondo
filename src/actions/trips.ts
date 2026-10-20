"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, knownErrorCode } from "@/lib/order-errors";
import { createClient } from "@/lib/supabase/server";
import { tripDayCount } from "@/lib/trip-dates";
import {
  bookingItemSchema,
  tripItemSchema,
  tripSchema,
  type TripInput,
} from "@/lib/validation/trip";

/**
 * 일정 플래너 Server Actions
 * 공통 흐름: 로그인 확인 → Zod 검증 → supabase-js(RLS: 본인 여행만) → /my 다시 그리기
 * user_id는 보내지 않는다(DB 기본값 auth.uid()). 항목은 상위 여행의 소유자로 권한을 판단한다.
 */

const uuid = z.uuid();
const refresh = () => revalidatePath("/my");

const invalid = (message?: string): ActionResult => ({ ok: false, reason: "invalid", message });
const failed: ActionResult = { ok: false, reason: "error" };

/** DB 트리거가 던진 코드(booking_locked·booking_out_of_range)는 사용자 문장으로, 그 밖은 일반 실패 */
const dbFailure = (message: string | undefined): ActionResult => {
  const code = knownErrorCode(message);
  return code ? invalid(errorMessage(code)) : failed;
};

const BOOKING_REMOVE_MESSAGE =
  "예약한 상품은 일정에서 직접 지울 수 없어요. 예약 상세에서 예약을 취소하면 함께 빠져요.";

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

/**
 * 시작 시간 순 자리로 옮긴다 (사용자 피드백: 자동 정렬).
 * 시간이 있는 항목을, 그날 항목 중 시간이 더 늦은 첫 항목 바로 앞으로 옮긴다. 더 늦은 항목이 없으면 맨 끝.
 * 시간이 없는 항목은 비교하지 않고 사용자가 드래그로 둔 자리를 존중한다 (DB add_booking_to_trip과 같은 규칙).
 * 저장은 기존 순서 변경 함수(reorder_trip_items) 한 번으로 — 중간에 실패해도 순서가 반쯤 바뀌지 않는다.
 */
async function placeByTime(
  supabase: Supabase,
  tripId: string,
  dayIndex: number,
  itemId: string,
  time: string | null | undefined,
) {
  if (!time) return;
  const { data } = await supabase
    .from("trip_items")
    .select("id, time")
    .eq("trip_id", tripId)
    .eq("day_index", dayIndex)
    .order("position");
  if (!data) return;
  const others = data.filter((i) => i.id !== itemId);
  // DB time은 "08:00:00", 입력은 "08:00" → 앞 5자리로 비교
  const at = others.findIndex((i) => i.time !== null && i.time.slice(0, 5) > time);
  const ids = others.map((i) => i.id);
  const ordered = at === -1 ? [...ids, itemId] : [...ids.slice(0, at), itemId, ...ids.slice(at)];
  await supabase.rpc("reorder_trip_items", {
    p_trip_id: tripId,
    p_day_index: dayIndex,
    p_item_ids: ordered,
  });
}

/**
 * 여행 기간 안에 이용일이 있는데 플래너에 없는 예약을 붙인다 (DB attach_bookings, 0007).
 * 예: 주문 때 자동으로 생긴 여행을 지운 뒤 같은 기간의 여행을 새로 만들면 예약이 다시 들어온다.
 * 예약 항목은 사용자 권한으로 만들 수 없으므로(order_item_id GRANT 없음) DB 함수가 넣는다.
 */
async function attachBookings(supabase: Supabase, tripId: string) {
  await supabase.rpc("attach_bookings", { p_trip_id: tripId });
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
  await attachBookings(supabase, data.id);
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
    // 예약 항목은 여행 날짜가 바뀌면 DB(sync_booking_days)가 이용일 기준으로 Day를 다시 계산하고,
    // 이용일이 기간 밖이면 거부한다 → 여기서는 일반 항목만 확인
    .is("order_item_id", null)
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
  if (error) return dbFailure(error.message);
  // 기간을 넓혔다면 새로 들어온 날짜의 예약도 붙인다
  await attachBookings(supabase, tripId);
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

  const { data, error } = await supabase
    .from("trip_items")
    .insert({
      trip_id: tripId,
      day_index: parsed.data.dayIndex,
      position: await nextPosition(supabase, tripId, parsed.data.dayIndex),
      title: parsed.data.title,
      time: parsed.data.time ?? null,
      type: parsed.data.type,
      note: parsed.data.note ?? null,
      caution: parsed.data.caution ?? null,
    })
    .select("id")
    .single();
  if (error) return failed;
  await placeByTime(supabase, tripId, parsed.data.dayIndex, data.id, parsed.data.time);
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

/** 항목 수정 — 다른 날로 옮기거나 시간을 바꾸면 그날의 시작 시간 순 자리로 (시간이 없으면 맨 끝) */
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
    .select("day_index, time, order_item_id")
    .eq("id", itemId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!current) return invalid("일정을 찾을 수 없어요");
  // 예약 항목은 updateBookingItem으로만 고친다 (날짜·유형 변경 불가)
  if (current.order_item_id) return invalid(errorMessage("booking_locked"));

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
  if (error) return dbFailure(error.message);
  const newTime = parsed.data.time ?? null;
  if (movedDay || current.time?.slice(0, 5) !== newTime) {
    await placeByTime(supabase, tripId, parsed.data.dayIndex, itemId, newTime);
  }
  refresh();
  return { ok: true };
}

/** 예약 항목 수정 — 제목·시간·메모·주의 메모만 (날짜는 이용일, 유형은 "예약"으로 고정) */
export async function updateBookingItem(itemId: string, input: unknown): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = bookingItemSchema.safeParse(input);
  if (!uuid.safeParse(itemId).success || !parsed.success)
    return invalid(parsed.error?.issues[0]?.message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_items")
    .update({
      title: parsed.data.title,
      time: parsed.data.time ?? null,
      note: parsed.data.note ?? null,
      caution: parsed.data.caution ?? null,
    })
    .eq("id", itemId)
    .not("order_item_id", "is", null)
    .select("id, trip_id, day_index");
  if (error) return dbFailure(error.message);
  const [updated] = data ?? [];
  if (!updated) return invalid("일정을 찾을 수 없어요");
  // 시작 시간을 바꿨다면 그날 시간 순 자리로
  await placeByTime(supabase, updated.trip_id, updated.day_index, itemId, parsed.data.time);
  refresh();
  return { ok: true };
}

export async function removeTripItem(itemId: string): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!uuid.safeParse(itemId).success) return invalid();

  const supabase = await createClient();
  // 예약 항목은 DB 제한 정책(trip_items_delete_not_booking) 때문에 0행 삭제로 끝난다.
  // 조용히 실패하지 않도록 먼저 확인해 이유를 알려 준다
  const { data: item } = await supabase
    .from("trip_items")
    .select("order_item_id")
    .eq("id", itemId)
    .maybeSingle();
  if (item?.order_item_id) return invalid(BOOKING_REMOVE_MESSAGE);

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
