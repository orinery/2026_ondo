import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OperatorCancelDialog } from "@/components/admin/operator-cancel-dialog";
import { OrderMemos } from "@/components/admin/order-memos";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { RefundAdjustDialog } from "@/components/admin/refund-adjust-dialog";
import { OrderItemList } from "@/components/checkout/order-item-list";
import { ConsolePageHeader } from "@/components/console/console-shell";
import { ItemStatusBadge, OrderStatusBadge } from "@/components/orders/order-status-badge";
import { requireRole } from "@/lib/auth";
import { getOrderMemos, getOrderTimeline, getSettledItemIds } from "@/lib/data/admin";
import { getOrderByNo, getRefundQuote, type OrderItem } from "@/lib/data/orders";
import { monthLabel } from "@/lib/data/settlements";
import { formatKrw, formatTimestamp } from "@/lib/format";
import { seoulNow } from "@/lib/trip-dates";

export const metadata: Metadata = { title: "주문 상세" };

/**
 * 관리자: 주문 상세 (/admin/orders/[orderNo]) — 항목·예약자·결제 + 처리(운영자 취소·환불 조정) + CS 메모 + 처리 이력.
 * 고객 화면과 같은 조회 함수를 쓴다: 관리자는 RLS(orders/order_items_select_admin)로 모든 주문을 읽을 수 있다.
 * 처리 버튼은 DB 함수와 같은 조건일 때만 보인다 (최종 판단은 DB 함수가 다시 한다).
 */
export default async function AdminOrderDetailPage({
  params,
}: PageProps<"/admin/orders/[orderNo]">) {
  const { orderNo } = await params;
  await requireRole("admin", `/admin/orders/${orderNo}`);
  const order = await getOrderByNo(orderNo);
  if (!order) notFound();
  const [timeline, memos, quote, settledIds] = await Promise.all([
    getOrderTimeline(order.id),
    getOrderMemos(order.id),
    getRefundQuote(order.id),
    getSettledItemIds(order.id),
  ]);
  const { today } = seoulNow();
  const thisMonth = monthLabel(`${today.slice(0, 7)}-01`);

  // 운영자 취소: 확정 대기·확정이고 이용일 당일까지 / 환불 조정: 끝난 항목(취소·이용 완료·이용일 지난 확정)
  const cancellable = (i: OrderItem) =>
    (i.status === "pending" || i.status === "confirmed") && i.useDate >= today;
  const adjustable = (i: OrderItem) =>
    (i.status === "cancelled" || i.status === "used" || i.status === "confirmed") &&
    !cancellable(i) &&
    (i.refundAmount ?? 0) < i.subtotal;

  const actionsOf = (i: OrderItem) => {
    if (cancellable(i)) {
      const q = quote.find((l) => l.orderItemId === i.id);
      return (
        <OperatorCancelDialog
          orderNo={order.orderNo}
          itemId={i.id}
          title={i.productTitle}
          subtotal={i.subtotal}
          policyRefund={
            q && i.useDate > today
              ? {
                  amount: q.refundAmount,
                  label: q.pending
                    ? "확정 대기 100%"
                    : `이용 ${q.daysBefore}일 전 ${q.refundRate}%`,
                }
              : null
          }
        />
      );
    }
    if (adjustable(i)) {
      return (
        <RefundAdjustDialog
          orderNo={order.orderNo}
          itemId={i.id}
          title={i.productTitle}
          subtotal={i.subtotal}
          currentRefund={i.refundAmount ?? 0}
          settledMonthNote={
            settledIds.has(i.id)
              ? `이용월 정산이 이미 완료됐어요. 완료된 숫자는 그대로 두고 ${thisMonth} 정산에 조정 전표로 반영돼요.`
              : null
          }
        />
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon aria-hidden className="size-4" />
        주문 목록
      </Link>
      <ConsolePageHeader
        eyebrow="Order"
        title={order.orderNo}
        description={`결제 ${formatTimestamp(order.paidAt, true)}`}
        actions={<OrderStatusBadge status={order.displayStatus} />}
      />
      <OrderItemList
        lines={order.items.map((i) => {
          const actions = actionsOf(i);
          const facts = [
            i.voucherCode && `바우처 ${i.voucherCode}`,
            (i.refundAmount ?? 0) > 0 && `환불 ${formatKrw(i.refundAmount ?? 0)}`,
            i.rejectReason && `거절 사유: ${i.rejectReason}`,
            i.cancelReason && `운영자 취소: ${i.cancelReason}`,
          ].filter(Boolean);
          return {
            id: i.id,
            slug: i.productSlug,
            title: i.productTitle,
            cityName: i.cityName,
            imageUrl: i.imageUrl,
            badge: <ItemStatusBadge status={i.displayStatus} />,
            useDate: i.useDate,
            startTime: i.startTime,
            adultQty: i.adultQty,
            childQty: i.childQty,
            options: i.options,
            subtotal: i.subtotal,
            note:
              facts.length > 0 || actions ? (
                <div className="mt-1 flex flex-col items-start gap-2">
                  {facts.length > 0 && (
                    <p className="text-sm text-muted-foreground">{facts.join(" · ")}</p>
                  )}
                  {actions}
                </div>
              ) : undefined,
          };
        })}
      />
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 text-sm">
          <dt className="mb-2 font-semibold">예약자</dt>
          <dd className="flex flex-col gap-1">
            <span>{order.bookerName}</span>
            <span className="tabular-nums">{order.bookerPhone}</span>
            <span className="break-all">{order.bookerEmail}</span>
          </dd>
        </div>
        <div className="rounded-xl border bg-card p-5 text-sm">
          <dt className="mb-2 font-semibold">결제</dt>
          <dd className="flex flex-col gap-1">
            <span>모의 결제 · {formatKrw(order.totalAmount)}</span>
            {(order.refundAmount ?? 0) > 0 && (
              <span>환불 {formatKrw(order.refundAmount ?? 0)}</span>
            )}
            {order.cancelledAt && <span>취소 {formatTimestamp(order.cancelledAt, true)}</span>}
          </dd>
        </div>
      </dl>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OrderTimeline
          entries={timeline}
          itemTitles={new Map(order.items.map((i) => [i.id, i.productTitle]))}
        />
        <OrderMemos orderNo={order.orderNo} orderId={order.id} memos={memos} />
      </div>
    </div>
  );
}
