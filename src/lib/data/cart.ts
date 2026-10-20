import "server-only";

import { bookingError, type BookingErrorCode, type BookingRules } from "@/lib/booking";
import type { CancellationPolicy } from "@/lib/data/products";
import { createClient } from "@/lib/supabase/server";
import { seoulNow } from "@/lib/trip-dates";

/**
 * 장바구니 조회 (Data Access Layer) — RLS로 본인 장바구니만 나온다.
 * 가격은 장바구니에 저장하지 않으므로 항상 상품의 "현재 가격"으로 계산해 보여준다.
 */

export type CartItem = {
  id: string;
  useDate: string;
  adultQty: number;
  childQty: number;
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

const CART_COLUMNS = `id, use_date, adult_qty, child_qty, created_at,
  products ( id, slug, title, image_url, image_alt, adult_price, child_price, operating_days,
             cutoff_days, max_qty, unavailable_reason, start_time, cities ( name ),
             cancellation_policies ( code, name, summary, cancellation_policy_tiers ( days_before, refund_rate ) ) )`;

/** ids를 주면 그 항목만 (주문서), 없으면 전체 (장바구니) */
export async function getCartItems(ids?: string[]): Promise<CartItem[]> {
  const supabase = await createClient();
  let query = supabase.from("cart_items").select(CART_COLUMNS);
  if (ids) query = query.in("id", ids);
  // 이용일이 빠른 순 → 같은 날은 먼저 담은 순
  const { data, error } = await query.order("use_date").order("created_at");
  if (error) throw error;

  const { today } = seoulNow();
  return (data ?? []).flatMap((row) => {
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
    return [
      {
        id: row.id,
        useDate: row.use_date,
        adultQty: row.adult_qty,
        childQty: row.child_qty,
        product,
        subtotal: row.adult_qty * p.adult_price + row.child_qty * (p.child_price ?? 0),
        error: bookingError(product, row.use_date, row.adult_qty, row.child_qty, today),
      },
    ];
  });
}
