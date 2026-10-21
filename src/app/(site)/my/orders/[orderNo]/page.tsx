import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderItemList } from "@/components/checkout/order-item-list";
import { CancelOrderDialog, type RefundPreview } from "@/components/orders/cancel-order-dialog";
import { ItemStatusBadge, OrderStatusBadge } from "@/components/orders/order-status-badge";
import { VoucherCard } from "@/components/orders/voucher-card";
import { CancellationPolicyTable } from "@/components/product/cancellation-policy-table";
import { Button } from "@/components/ui/button";
import { getOrderByNo, getRefundQuote, type OrderItem } from "@/lib/data/orders";
import { formatKrw, formatTimestamp } from "@/lib/format";

export const metadata: Metadata = {
  title: "예약 상세",
  robots: { index: false, follow: false },
};

const dateTime = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

/**
 * 예약 상세 (나의 여행 > 예약 내역 > 주문)
 * 상품(주문 항목)마다 상태가 다를 수 있다: 확정 대기 · 예약 확정(바우처) · 이용 완료 · 거절 · 취소 · 기한 초과.
 * 취소는 주문 전체(취소할 수 있는 상품 모두) 또는 상품 하나씩.
 */
export default async function OrderDetailPage({ params }: PageProps<"/my/orders/[orderNo]">) {
  const { orderNo } = await params;
  const order = await getOrderByNo(orderNo);
  if (!order) notFound();

  // 취소할 수 있을 때만 환불 예정액을 계산한다 (DB 함수 refund_quote = 실제 취소와 같은 계산)
  const quote = order.cancellable ? await getRefundQuote(order.id) : [];
  const preview = (q: (typeof quote)[number]): RefundPreview => ({
    title: order.items.find((i) => i.id === q.orderItemId)?.productTitle ?? "상품",
    daysBefore: q.daysBefore,
    refundRate: q.refundRate,
    refundAmount: q.refundAmount,
    pending: q.pending,
  });
  // 취소 가능 = 이용일 전의 확정 대기·확정 (주문 전체 취소는 이 항목들만 취소한다)
  const cancellableQuotes = quote.filter((q) => q.daysBefore > 0);
  const vouchers = order.items.filter((i) => i.displayStatus === "confirmed" && i.voucherCode);
  const policies = [
    ...new Map(order.items.map((i) => [i.cancelPolicy.code, i.cancelPolicy])).values(),
  ];

  /** 상품 아래 안내 — 상태별 */
  const noteOf = (i: OrderItem) => {
    const itemQuote = cancellableQuotes.find((q) => q.orderItemId === i.id);
    // 상품이 여러 개일 때만 상품별 취소 버튼 (하나면 위의 "예약 취소"와 같다)
    const itemCancel =
      itemQuote && order.items.length > 1 ? (
        <CancelOrderDialog
          target={{ kind: "item", itemId: i.id }}
          orderNo={order.orderNo}
          lines={[preview(itemQuote)]}
        />
      ) : null;
    switch (i.displayStatus) {
      case "pending":
        return (
          <div className="mt-1 flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              파트너가 확인하고 있어요.
              {i.confirmDeadline &&
                ` ${formatTimestamp(i.confirmDeadline, true)}까지 확정되며,`}{" "}
              확정되지 않으면 전액 환불돼요.
            </p>
            {itemCancel}
          </div>
        );
      case "processing":
        return (
          <p className="mt-1 text-sm text-muted-foreground">
            확정 기한이 지나 자동 취소·전액 환불을 처리하고 있어요.
          </p>
        );
      case "confirmed":
        return itemCancel ? <div className="mt-1">{itemCancel}</div> : undefined;
      case "used":
        // 이용을 마친 상품 → 리뷰 쓰기 (상세 페이지의 리뷰 다이얼로그로)
        return i.productSlug ? (
          <Link
            href={`/products/${i.productSlug}#reviews-title`}
            className="mt-1 self-start text-sm font-semibold text-primary hover:underline"
          >
            리뷰 쓰기 →
          </Link>
        ) : undefined;
      case "rejected":
        return (
          <p className="mt-1 text-sm text-muted-foreground">
            파트너가 예약을 받지 못했어요{i.rejectReason && ` (${i.rejectReason})`} · 환불{" "}
            {formatKrw(i.refundAmount ?? 0)}
          </p>
        );
      case "cancelled":
      case "expired":
        return (
          <p className="mt-1 text-sm text-muted-foreground">
            환불 {formatKrw(i.refundAmount ?? 0)}
          </p>
        );
    }
  };

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
            {cancellableQuotes.length > 0 && (
              <CancelOrderDialog
                target={{ kind: "order", orderId: order.id }}
                orderNo={order.orderNo}
                lines={cancellableQuotes.map(preview)}
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
            badge: <ItemStatusBadge status={i.displayStatus} />,
            useDate: i.useDate,
            startTime: i.startTime,
            adultQty: i.adultQty,
            childQty: i.childQty,
            options: i.options,
            subtotal: i.subtotal,
            note: noteOf(i),
          }))}
        />
      </section>

      {vouchers.length > 0 && (
        <section aria-labelledby="voucher-title" className="flex flex-col gap-4">
          <h2 id="voucher-title" className="font-kr text-xl font-semibold">
            바우처
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {vouchers.map((i) => (
              <VoucherCard
                key={i.id}
                code={i.voucherCode ?? ""}
                title={i.productTitle}
                useDate={i.useDate}
                startTime={i.startTime}
                people={i.adultQty + i.childQty}
              />
            ))}
          </div>
        </section>
      )}

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
              </>
            )}
            {/* 일부 상품만 취소·거절돼도 환불액이 생긴다 */}
            {(order.refundAmount ?? 0) > 0 && (
              <>
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
        <p className="text-sm text-muted-foreground">
          파트너 확정을 기다리는 상품은 규정과 상관없이 전액 환불돼요. 이용일 당일·이후에는 취소할
          수 없어요.
        </p>
      </section>
    </div>
  );
}
