import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderItemList } from "@/components/checkout/order-item-list";
import { ConsolePageHeader } from "@/components/console/console-shell";
import { ItemStatusBadge, OrderStatusBadge } from "@/components/orders/order-status-badge";
import { requireRole } from "@/lib/auth";
import { getOrderByNo } from "@/lib/data/orders";
import { formatKrw, formatTimestamp } from "@/lib/format";

export const metadata: Metadata = { title: "주문 상세" };

/**
 * 관리자: 주문 상세 (/admin/orders/[orderNo]) — 읽기 전용.
 * 고객 화면과 같은 조회 함수를 쓴다: 관리자는 RLS(orders/order_items_select_admin)로 모든 주문을 읽을 수 있다.
 */
export default async function AdminOrderDetailPage({
  params,
}: PageProps<"/admin/orders/[orderNo]">) {
  const { orderNo } = await params;
  await requireRole("admin", `/admin/orders/${orderNo}`);
  const order = await getOrderByNo(orderNo);
  if (!order) notFound();

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
        lines={order.items.map((i) => ({
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
            (i.refundAmount ?? 0) > 0 || i.voucherCode ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {i.voucherCode && `바우처 ${i.voucherCode}`}
                {i.voucherCode && (i.refundAmount ?? 0) > 0 && " · "}
                {(i.refundAmount ?? 0) > 0 && `환불 ${formatKrw(i.refundAmount ?? 0)}`}
                {i.rejectReason && ` · 거절 사유: ${i.rejectReason}`}
              </p>
            ) : undefined,
        }))}
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
    </div>
  );
}
