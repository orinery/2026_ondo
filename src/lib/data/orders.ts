import "server-only";

import type { QueryData } from "@supabase/supabase-js";
import { cache } from "react";

import type { OrderStatus } from "@/lib/constants/taxonomy";
import type { CancellationPolicy } from "@/lib/data/products";
import { displayStatus, isCancellable, type DisplayStatus } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/server";
import { seoulNow } from "@/lib/trip-dates";

/**
 * 주문 조회 (Data Access Layer)
 * orders·order_items는 RLS가 본인 것만 SELECT하게 한다. 남의 주문번호로 조회하면 null → 404.
 */

export type OrderItem = {
  id: string;
  productId: string;
  productSlug: string;
  productTitle: string; // 구매 시점의 상품명 (이후 상품명이 바뀌어도 그대로)
  imageUrl: string;
  imageAlt: string;
  cityName: string;
  useDate: string;
  adultQty: number;
  childQty: number;
  adultPrice: number; // 구매 시점 단가
  childPrice: number | null;
  subtotal: number;
  refundAmount: number | null;
  cancelPolicy: CancellationPolicy;
};

export type OrderSummary = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  displayStatus: DisplayStatus;
  cancellable: boolean;
  totalAmount: number;
  refundAmount: number | null;
  paidAt: string;
  cancelledAt: string | null;
  items: OrderItem[];
};

export type OrderDetail = OrderSummary & {
  bookerName: string;
  bookerEmail: string;
  bookerPhone: string;
  paymentMethod: string;
  tripId: string | null; // 플래너에 자동 추가된 여행 (취소되면 null)
};

const ORDER_COLUMNS = `id, order_no, status, total_amount, refund_amount, paid_at, cancelled_at,
  booker_name, booker_email, booker_phone, payment_method,
  order_items ( id, product_id, product_title, use_date, adult_qty, child_qty, adult_price, child_price,
                subtotal, refund_amount,
                products ( slug, image_url, image_alt, cities ( name ) ),
                cancellation_policies ( code, name, summary, cancellation_policy_tiers ( days_before, refund_rate ) ),
                trip_items ( trip_id ) )`;

// select 문자열에서 추론한 행 타입 (trip_items는 order_item_id가 unique라 1:1 → 객체 또는 null)
const ordersQuery = (supabase: Awaited<ReturnType<typeof createClient>>) =>
  supabase.from("orders").select(ORDER_COLUMNS);
type OrderRow = QueryData<ReturnType<typeof ordersQuery>>[number];

function toDetail(row: OrderRow, today: string): OrderDetail {
  const items: OrderItem[] = [...row.order_items]
    .sort((a, b) => a.use_date.localeCompare(b.use_date))
    .map((i) => ({
      id: i.id,
      productId: i.product_id,
      productSlug: i.products.slug,
      productTitle: i.product_title,
      imageUrl: i.products.image_url,
      imageAlt: i.products.image_alt,
      cityName: i.products.cities.name,
      useDate: i.use_date,
      adultQty: i.adult_qty,
      childQty: i.child_qty,
      adultPrice: i.adult_price,
      childPrice: i.child_price,
      subtotal: i.subtotal,
      refundAmount: i.refund_amount,
      cancelPolicy: {
        code: i.cancellation_policies.code,
        name: i.cancellation_policies.name,
        summary: i.cancellation_policies.summary,
        tiers: [...i.cancellation_policies.cancellation_policy_tiers]
          .sort((a, b) => b.days_before - a.days_before)
          .map((t) => ({ daysBefore: t.days_before, refundRate: t.refund_rate })),
      },
    }));
  const useDates = items.map((i) => i.useDate);
  return {
    id: row.id,
    orderNo: row.order_no,
    status: row.status,
    displayStatus: displayStatus(row.status, useDates, today),
    cancellable: isCancellable(row.status, useDates, today),
    totalAmount: row.total_amount,
    refundAmount: row.refund_amount,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at,
    bookerName: row.booker_name,
    bookerEmail: row.booker_email,
    bookerPhone: row.booker_phone,
    paymentMethod: row.payment_method,
    tripId: row.order_items.find((i) => i.trip_items)?.trip_items?.trip_id ?? null,
    items,
  };
}

/** 나의 여행 > 예약 내역 — 최근 결제 순 (포트폴리오 규모라 50건까지 한 번에) */
export async function getMyOrders(): Promise<OrderSummary[]> {
  const supabase = await createClient();
  const { data, error } = await ordersQuery(supabase)
    .order("paid_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const { today } = seoulNow();
  return (data ?? []).map((row) => toDetail(row, today));
}

/** 예약 상세·주문 완료 — 레이아웃(404 판정)과 페이지가 함께 불러도 한 번만 조회 */
export const getOrderByNo = cache(async (orderNo: string): Promise<OrderDetail | null> => {
  // 주문번호 형식이 아니면 조회하지 않는다 (YO261015-000123)
  if (!/^YO\d{6}-\d{6,}$/.test(orderNo)) return null;
  const supabase = await createClient();
  const { data, error } = await ordersQuery(supabase).eq("order_no", orderNo).maybeSingle();
  if (error) throw error;
  return data ? toDetail(data, seoulNow().today) : null;
});

export type RefundQuoteLine = {
  orderItemId: string;
  daysBefore: number;
  refundRate: number;
  refundAmount: number;
};

/** 취소 확인 창의 환불 예정액 — 실제 취소(cancel_order)와 같은 DB 함수로 계산한다 */
export async function getRefundQuote(orderId: string): Promise<RefundQuoteLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("refund_quote", { p_order_id: orderId });
  if (error) throw error;
  return (data ?? []).map((q) => ({
    orderItemId: q.order_item_id,
    daysBefore: q.days_before,
    refundRate: q.refund_rate,
    refundAmount: q.refund_amount,
  }));
}
