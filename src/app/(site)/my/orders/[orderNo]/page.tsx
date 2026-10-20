import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderItemList } from "@/components/checkout/order-item-list";
import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { CancellationPolicyTable } from "@/components/product/cancellation-policy-table";
import { Button } from "@/components/ui/button";
import { getOrderByNo, getRefundQuote } from "@/lib/data/orders";
import { formatKrw } from "@/lib/format";
import { seoulNow } from "@/lib/trip-dates";

export const metadata: Metadata = {
  title: "예약 상세",
  robots: { index: false, follow: false },
};

const dateTime = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

/** 예약 상세 (나의 여행 > 예약 내역 > 주문) */
export default async function OrderDetailPage({ params }: PageProps<"/my/orders/[orderNo]">) {
  const { orderNo } = await params;
  const order = await getOrderByNo(orderNo);
  if (!order) notFound();

  const { today } = seoulNow();
  // 취소할 수 있을 때만 환불 예정액을 계산한다 (DB 함수 refund_quote = 실제 취소와 같은 계산)
  const quote = order.cancellable ? await getRefundQuote(order.id) : [];
  const policies = [
    ...new Map(order.items.map((i) => [i.cancelPolicy.code, i.cancelPolicy])).values(),
  ];

  return (
    <div className="container flex max-w-4xl flex-col gap-10 py-10 md:py-14">
      <div className="flex flex-col gap-4">
        <Link
          href="/my?tab=orders"
          className="inline-flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon aria-hidden className="size-4" />
          예약 내역
        </Link>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <OrderStatusBadge status={order.displayStatus} />
              결제 {dateTime.format(new Date(order.paidAt))}
            </p>
            <h1 className="mt-2 font-kr text-3xl font-semibold tabular-nums">{order.orderNo}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {order.tripId && (
              <Button asChild variant="ghost" className="h-11 rounded-md px-4 text-base">
                <Link href={`/my?tab=planner&trip=${order.tripId}`}>일정 플래너에서 보기</Link>
              </Button>
            )}
            {order.cancellable && (
              <CancelOrderDialog
                orderId={order.id}
                orderNo={order.orderNo}
                lines={quote.map((q) => ({
                  title: order.items.find((i) => i.id === q.orderItemId)?.productTitle ?? "상품",
                  daysBefore: q.daysBefore,
                  refundRate: q.refundRate,
                  refundAmount: q.refundAmount,
                }))}
              />
            )}
          </div>
        </header>
      </div>

      <section aria-labelledby="items-title" className="flex flex-col gap-4">
        <h2 id="items-title" className="font-kr text-xl font-semibold">
          예약 상품
        </h2>
        <OrderItemList
          lines={order.items.map((i) => ({
            id: i.id,
            slug: i.productSlug,
            title: i.productTitle,
            cityName: i.cityName,
            imageUrl: i.imageUrl,
            useDate: i.useDate,
            adultQty: i.adultQty,
            childQty: i.childQty,
            subtotal: i.subtotal,
            note:
              order.status === "cancelled" ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  환불 {formatKrw(i.refundAmount ?? 0)}
                </p>
              ) : i.useDate < today ? (
                // 이용을 마친 상품 → 리뷰 쓰기 (상세 페이지의 리뷰 다이얼로그로)
                <Link
                  href={`/products/${i.productSlug}#reviews-title`}
                  className="mt-1 self-start text-sm font-semibold text-primary hover:underline"
                >
                  리뷰 쓰기 →
                </Link>
              ) : undefined,
          }))}
        />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="booker-title" className="rounded-lg border bg-card p-5">
          <h2 id="booker-title" className="text-base font-semibold">
            예약자 정보
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">이름</dt>
            <dd>{order.bookerName}</dd>
            <dt className="text-muted-foreground">휴대폰</dt>
            <dd className="tabular-nums">{order.bookerPhone}</dd>
            <dt className="text-muted-foreground">이메일</dt>
            <dd className="break-all">{order.bookerEmail}</dd>
          </dl>
        </section>
        <section aria-labelledby="pay-title" className="rounded-lg border bg-card p-5">
          <h2 id="pay-title" className="text-base font-semibold">
            결제 정보
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">결제 수단</dt>
            <dd>모의 결제</dd>
            <dt className="text-muted-foreground">결제 금액</dt>
            <dd className="font-semibold">{formatKrw(order.totalAmount)}</dd>
            {order.status === "cancelled" && (
              <>
                <dt className="text-muted-foreground">취소일</dt>
                <dd>{order.cancelledAt ? dateTime.format(new Date(order.cancelledAt)) : "-"}</dd>
                <dt className="text-muted-foreground">환불 금액</dt>
                <dd className="font-semibold">{formatKrw(order.refundAmount ?? 0)}</dd>
              </>
            )}
          </dl>
        </section>
      </div>

      <section aria-labelledby="policy-title" className="flex flex-col gap-4">
        <h2 id="policy-title" className="font-kr text-xl font-semibold">
          취소 규정
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {policies.map((p) => (
            <CancellationPolicyTable
              key={p.code}
              name={p.name}
              summary={p.summary}
              tiers={p.tiers}
            />
          ))}
        </div>
        {!order.cancellable && order.status === "paid" && (
          <p className="text-sm text-muted-foreground">
            이용일 당일·이후인 상품이 있어 이 예약은 취소할 수 없어요.
          </p>
        )}
      </section>
    </div>
  );
}
