import "server-only";

import {
  bookingError,
  lineTotal,
  optionsAmount,
  slotAvailability,
  slotError,
  type BookingErrorCode,
  type BookingRules,
  type OptionRule,
} from "@/lib/booking";
import type { CancellationPolicy } from "@/lib/data/products";
import { createClient } from "@/lib/supabase/server";
import { seoulNow } from "@/lib/trip-dates";

/**
 * 장바구니 조회 (Data Access Layer) — RLS로 본인 장바구니만 나온다.
 * 가격은 장바구니에 저장하지 않으므로 항상 "현재 가격"으로 계산해 보여준다:
 * 날짜·회차에 덮어쓴 가격이 있으면 그것 + 고른 옵션 금액 (DB line_price와 같은 공식 → 결제 금액과 일치).
 */

export type CartItem = {
  id: string;
  useDate: string;
  adultQty: number;
  childQty: number;
  slot: { id: string; startTime: string | null };
  // 이 날짜·회차에 실제로 적용되는 단가 (덮어쓴 가격 반영)
  prices: { adultPrice: number; childPrice: number | null };
  options: OptionRule[]; // 고른 옵션
  optionsAmount: number;
  product: BookingRules & {
    id: string;
    slug: string;
    title: string;
    imageUrl: string;
    imageAlt: string;
    cityName: string;
    startTime: string | null;
    cancelPolicy: CancellationPolicy;
  };
  subtotal: number;
  // 담은 뒤 상품 조건이 바뀌었거나 날짜가 지나 예약할 수 없게 된 경우의 이유 (null = 주문 가능)
  error: BookingErrorCode | null;
};

const CART_COLUMNS = `id, use_date, adult_qty, child_qty, option_ids, created_at,
  product_slots ( id, start_time, capacity, active ),
  products ( id, slug, title, image_url, image_alt, adult_price, child_price, operating_days,
             cutoff_days, max_qty, unavailable_reason, start_time, cities ( name ),
             product_options ( id, name, price, unit, active ),
             cancellation_policies ( code, name, summary, cancellation_policy_tiers ( days_before, refund_rate ) ) )`;

/** ids를 주면 그 항목만 (주문서), 없으면 전체 (장바구니) */
export async function getCartItems(ids?: string[]): Promise<CartItem[]> {
  const supabase = await createClient();
  let query = supabase.from("cart_items").select(CART_COLUMNS);
  if (ids) query = query.in("id", ids);
  // 이용일이 빠른 순 → 같은 날은 먼저 담은 순
  const { data, error } = await query.order("use_date").order("created_at");
  if (error) throw error;

  const rows = data ?? [];

  // 담긴 날짜·회차의 재고 행(덮어쓴 정원·가격·마감, 예약 인원)을 한 번에 읽는다
  const slotIds = [...new Set(rows.map((r) => r.product_slots.id))];
  const { data: inventory, error: inventoryError } =
    slotIds.length > 0
      ? await supabase
          .from("slot_inventory")
          .select("slot_id, use_date, capacity, closed, adult_price, child_price, booked")
          .in("slot_id", slotIds)
          .in("use_date", [...new Set(rows.map((r) => r.use_date))])
      : { data: [], error: null };
  if (inventoryError) throw inventoryError;
  const inventoryOf = (slotId: string, useDate: string) => {
    const i = inventory.find((x) => x.slot_id === slotId && x.use_date === useDate);
    return i
      ? {
          slotId,
          useDate,
          capacity: i.capacity,
          closed: i.closed,
          adultPrice: i.adult_price,
          childPrice: i.child_price,
          booked: i.booked,
        }
      : undefined;
  };

  const { today } = seoulNow();
  return rows.flatMap((row) => {
    const p = row.products;
    if (!p) return [];
    const product = {
      id: p.id,
      slug: p.slug,
      title: p.title,
      imageUrl: p.image_url,
      imageAlt: p.image_alt,
      cityName: p.cities.name,
      startTime: p.start_time ? p.start_time.slice(0, 5) : null,
      cancelPolicy: {
        code: p.cancellation_policies.code,
        name: p.cancellation_policies.name,
        summary: p.cancellation_policies.summary,
        tiers: [...p.cancellation_policies.cancellation_policy_tiers]
          .sort((a, b) => b.days_before - a.days_before)
          .map((t) => ({ daysBefore: t.days_before, refundRate: t.refund_rate })),
      },
      adultPrice: p.adult_price,
      childPrice: p.child_price,
      operatingDays: p.operating_days,
      cutoffDays: p.cutoff_days,
      maxQty: p.max_qty,
      unavailableReason: p.unavailable_reason,
    };
    const s = row.product_slots;
    const qty = row.adult_qty + row.child_qty;
    const availability = slotAvailability(
      product,
      { id: s.id, startTime: s.start_time, capacity: s.capacity },
      inventoryOf(s.id, row.use_date),
    );
    const allOptions = p.product_options.map((o) => ({
      id: o.id,
      name: o.name,
      price: o.price,
      unit: o.unit,
      active: o.active,
    }));
    const options = allOptions.filter((o) => row.option_ids.includes(o.id));
    const optionTotal = optionsAmount(options, row.option_ids, qty);
    // 담은 뒤 판매가 끝난 옵션이 있으면 주문할 수 없다 (DB booking_error의 option_invalid)
    const optionInvalid =
      options.length !== row.option_ids.length || options.some((o) => !o.active);

    return [
      {
        id: row.id,
        useDate: row.use_date,
        adultQty: row.adult_qty,
        childQty: row.child_qty,
        slot: { id: s.id, startTime: s.start_time ? s.start_time.slice(0, 5) : null },
        prices: { adultPrice: availability.adultPrice, childPrice: availability.childPrice },
        options: options.map(({ id, name, price, unit }) => ({ id, name, price, unit })),
        optionsAmount: optionTotal,
        product,
        subtotal: lineTotal(availability, row.adult_qty, row.child_qty, optionTotal),
        // DB booking_error와 같은 순서: 상품·인원·날짜 → 회차 판매 여부 → 옵션 → 마감·잔여석
        error:
          bookingError(product, row.use_date, row.adult_qty, row.child_qty, today) ??
          (s.active ? null : "slot_not_found") ??
          (optionInvalid ? "option_invalid" : null) ??
          slotError(availability, qty),
      },
    ];
  });
}
