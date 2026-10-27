import "server-only";

import { addDays, type InventoryRow, type SlotRule } from "@/lib/booking";
import type { ConfirmationMode, OrderItemStatus, UserItemTypeSlug } from "@/lib/constants/taxonomy";
import { getInventory } from "@/lib/data/products";
import { itemDisplayStatus, type ItemDisplayStatus } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/server";
import type { ProductFormInput } from "@/lib/validation/product";

/**
 * 파트너 센터 조회 (Data Access Layer)
 * - 상품: products는 공개 상품도 누구나 읽을 수 있어서 RLS만으로는 "내 상품"만 걸러지지 않는다 → partner_id로 거른다
 * - 예약: order_items는 RLS(partner_id = 내 파트너)로, 예약자 연락처는 partner_bookings 함수로만
 * 부르는 페이지가 requireRole("partner")로 먼저 확인한다.
 */

export type PartnerProductRow = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string;
  cityName: string;
  adultPrice: number;
  confirmationMode: ConfirmationMode;
  // 판매 상태: 임시 저장 / 판매 중 / 판매 일시 중단(파트너) / 판매 중지(관리자)
  state: "draft" | "on_sale" | "paused" | "suspended";
  stateReason: string | null;
  slotCount: number;
  reviewCount: number;
};

export async function getPartnerProducts(partnerId: string): Promise<PartnerProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, slug, title, image_url, adult_price, confirmation_mode, published_at, unavailable_reason,
       suspended_reason, review_count, cities ( name ), product_slots ( active )`,
    )
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    imageUrl: p.image_url,
    cityName: p.cities.name,
    adultPrice: p.adult_price,
    confirmationMode: p.confirmation_mode,
    state: p.suspended_reason
      ? "suspended"
      : !p.published_at
        ? "draft"
        : p.unavailable_reason
          ? "paused"
          : "on_sale",
    stateReason: p.suspended_reason ?? p.unavailable_reason,
    slotCount: p.product_slots.filter((s) => s.active).length,
    reviewCount: p.review_count,
  }));
}

/** 상품 폼의 선택지 (도시·취소 규정) */
export async function getProductFormChoices() {
  const supabase = await createClient();
  const [cities, policies] = await Promise.all([
    supabase.from("cities").select("id, name").order("position"),
    supabase.from("cancellation_policies").select("code, name, summary").order("code"),
  ]);
  if (cities.error) throw cities.error;
  if (policies.error) throw policies.error;
  return { cities: cities.data, policies: policies.data };
}

export type PartnerProductForm = ProductFormInput & {
  id: string;
  suspendedReason: string | null;
};

/** 수정 폼의 초기값 — 내 상품이 아니면 null (페이지에서 404) */
export async function getPartnerProductForm(
  partnerId: string,
  productId: string,
): Promise<PartnerProductForm | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `*, product_images ( url, alt, position ),
       product_itinerary_items ( position, time, title, note, type, caution ),
       product_slots ( start_time, capacity, active, position ),
       product_options ( name, price, unit, active, position )`,
    )
    .eq("id", productId)
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const byPosition = <T extends { position: number }>(rows: T[]) =>
    [...rows].sort((a, b) => a.position - b.position);
  return {
    id: data.id,
    suspendedReason: data.suspended_reason,
    slug: data.slug,
    cityId: data.city_id,
    category: data.category,
    theme: data.theme,
    title: data.title,
    summary: data.summary,
    description: data.description,
    highlights: data.highlights,
    images: byPosition(data.product_images).map(({ url, alt }) => ({ url, alt })),
    adultPrice: data.adult_price,
    childPrice: data.child_price,
    listAdultPrice: data.list_adult_price,
    operatingDays: data.operating_days,
    cutoffDays: data.cutoff_days,
    maxQty: data.max_qty,
    durationText: data.duration_text,
    includes: data.includes,
    excludes: data.excludes,
    usageInfo: data.usage_info,
    meetingPoint: data.meeting_point,
    latitude: data.latitude,
    longitude: data.longitude,
    cancelPolicy: data.cancel_policy,
    unavailableReason: data.unavailable_reason,
    confirmationMode: data.confirmation_mode,
    publish: data.published_at !== null,
    slots: byPosition(data.product_slots.filter((s) => s.active)).map((s) => ({
      startTime: s.start_time ? s.start_time.slice(0, 5) : "",
      capacity: s.capacity,
    })),
    options: byPosition(data.product_options.filter((o) => o.active)).map((o) => ({
      name: o.name,
      price: o.price,
      unit: o.unit,
    })),
    itinerary: byPosition(data.product_itinerary_items).map((i) => ({
      time: i.time ? i.time.slice(0, 5) : "",
      title: i.title,
      note: i.note ?? "",
      // 상품 진행 일정에는 "예약" 유형이 없다 (DB enum에는 있지만 플래너 전용)
      type: (i.type === "booking" ? "sight" : i.type) satisfies UserItemTypeSlug,
      caution: i.caution ?? "",
    })),
  };
}

/** 재고 화면: 내 상품의 판매 중인 회차 + 예약 기간 재고 */
export async function getPartnerInventory(partnerId: string, productId: string, today: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, title, slug, adult_price, child_price, operating_days, cutoff_days, product_slots ( id, start_time, capacity, active, position )",
    )
    .eq("id", productId)
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const slots: SlotRule[] = [...data.product_slots]
    .filter((s) => s.active)
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      id: s.id,
      startTime: s.start_time ? s.start_time.slice(0, 5) : null,
      capacity: s.capacity,
    }));
  const inventory: InventoryRow[] = await getInventory(
    slots.map((s) => s.id),
    today,
  );
  return {
    product: {
      id: data.id,
      title: data.title,
      slug: data.slug,
      adultPrice: data.adult_price,
      childPrice: data.child_price,
      operatingDays: data.operating_days,
      cutoffDays: data.cutoff_days,
    },
    slots,
    inventory,
  };
}

export type PartnerBooking = {
  itemId: string;
  orderNo: string;
  productId: string;
  productTitle: string;
  useDate: string;
  startTime: string | null;
  adultQty: number;
  childQty: number;
  subtotal: number;
  refundAmount: number | null;
  status: OrderItemStatus;
  displayStatus: ItemDisplayStatus;
  confirmDeadline: string | null;
  voucherCode: string | null;
  rejectReason: string | null;
  cancelReason: string | null; // 운영자 취소 사유
  options: string;
  bookerName: string;
  bookerPhone: string;
  bookerEmail: string;
  // 연락처를 가린 값인지 — 원문은 살아 있는 예약 + 이용일 7일 뒤까지만 (A-06)
  contactMasked: boolean;
  paidAt: string;
};

/** 예약 목록 (이용일 기간, 90일 전 이용분부터) — 예약자 연락처는 이 함수로만 받는다 (기간이 지나면 가린 값) */
export async function getPartnerBookings(
  from: string,
  to: string,
  today: string,
): Promise<PartnerBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("partner_bookings", { p_from: from, p_to: to });
  if (error) throw error;
  const now = new Date();
  return data.map((b) => {
    const status = b.status as OrderItemStatus;
    return {
      itemId: b.item_id,
      orderNo: b.order_no,
      productId: b.product_id,
      productTitle: b.product_title,
      useDate: b.use_date,
      startTime: b.start_time ? b.start_time.slice(0, 5) : null,
      adultQty: b.adult_qty,
      childQty: b.child_qty,
      subtotal: b.subtotal,
      refundAmount: b.refund_amount,
      status,
      displayStatus: itemDisplayStatus(
        { status, useDate: b.use_date, confirmDeadline: b.confirm_deadline },
        today,
        now,
      ),
      confirmDeadline: b.confirm_deadline,
      voucherCode: b.voucher_code,
      rejectReason: b.reject_reason,
      cancelReason: b.cancel_reason,
      options: b.options,
      bookerName: b.booker_name,
      bookerPhone: b.booker_phone,
      bookerEmail: b.booker_email,
      contactMasked: b.contact_masked,
      paidAt: b.paid_at,
    };
  });
}

/** 파트너 홈 요약: 확정 대기(가장 가까운 기한) · 오늘 이용 · 이번 달 매출 */
export async function getPartnerSummary(partnerId: string, today: string) {
  const supabase = await createClient();
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = addDays(`${today.slice(0, 7)}-28`, 4).slice(0, 7) + "-01";
  const [pending, todays, month] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, confirm_deadline")
      .eq("partner_id", partnerId)
      .eq("status", "pending")
      .order("confirm_deadline"),
    supabase
      .from("order_items")
      .select("adult_qty, child_qty")
      .eq("partner_id", partnerId)
      .eq("use_date", today)
      .in("status", ["confirmed", "used"]),
    supabase
      .from("order_items")
      .select("subtotal, refund_amount, status")
      .eq("partner_id", partnerId)
      .gte("use_date", monthStart)
      .lt("use_date", nextMonth)
      .in("status", ["confirmed", "used", "cancelled"]),
  ]);
  if (pending.error) throw pending.error;
  if (todays.error) throw todays.error;
  if (month.error) throw month.error;
  return {
    pendingCount: pending.data.length,
    nearestDeadline: pending.data[0]?.confirm_deadline ?? null,
    todayBookings: todays.data.length,
    todayPeople: todays.data.reduce((n, r) => n + r.adult_qty + r.child_qty, 0),
    // 이번 달 이용분 매출 = 결제액 - 환불액 (취소돼도 환불하지 않은 금액은 파트너 몫 — 정산 규칙과 같음)
    monthRevenue: month.data.reduce((sum, r) => sum + r.subtotal - (r.refund_amount ?? 0), 0),
  };
}
