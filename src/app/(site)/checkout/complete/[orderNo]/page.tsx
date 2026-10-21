import { CheckCircle2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderItemList } from "@/components/checkout/order-item-list";
import { ItemStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { getOrderByNo } from "@/lib/data/orders";
import { formatKrw } from "@/lib/format";

export const metadata: Metadata = {
  title: "예약 완료",
  robots: { index: false, follow: false },
};

/** 주문 완료 — 결제(모의) 직후 이동하는 화면 */
export default async function OrderCompletePage({
  params,
}: PageProps<"/checkout/complete/[orderNo]">) {
  const { orderNo } = await params;
  // 레이아웃에서 이미 조회했다 (cache) — 여기서는 같은 결과를 다시 받는다
  const order = await getOrderByNo(orderNo);
  if (!order) notFound();
  const hasPending = order.items.some((i) => i.status === "pending");

  return (
    <div className="container flex max-w-3xl flex-col gap-8 py-12 md:py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-accent">
          <CheckCircle2Icon aria-hidden className="size-8 text-accent-foreground" />
        </div>
        <h1 className="font-kr text-3xl font-semibold md:text-4xl">
          {hasPending ? "결제가 완료됐어요" : "예약이 완료됐어요"}
        </h1>
        <p className="text-muted-foreground">
          주문번호{" "}
          <span className="font-semibold text-foreground tabular-nums">{order.orderNo}</span>
          {" · "}예약 확인 메일은 데모라 발송되지 않아요
        </p>
      </header>

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
        }))}
      />

      {hasPending && (
        // 파트너 확정 상품이 섞여 있으면 "완료"가 곧 확정이 아님을 분명히 알린다
        <p className="rounded-lg border bg-card p-4 text-sm">
          <span className="font-semibold">파트너 확정 상품</span>은 결제 후 최대 48시간 안에
          확정돼요. 확정되면 예약 상세에서 바우처를 볼 수 있고, 확정되지 않으면 전액 환불돼요.
        </p>
      )}

      <div className="flex items-baseline justify-between rounded-lg border bg-card p-5">
        <span className="font-medium">결제 금액 (모의 결제)</span>
        <span className="text-2xl font-semibold">{formatKrw(order.totalAmount)}</span>
      </div>

      {order.tripId && (
        <p className="rounded-lg bg-accent p-4 text-sm text-accent-foreground">
          이용일에 맞춰 <span className="font-semibold">나의 여행 &gt; 일정 플래너</span>에 예약을
          추가했어요. 같은 날 다른 일정도 함께 짜 보세요.
        </p>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:justify-center">
        <Button asChild className="h-12 rounded-md px-6 text-base font-semibold">
          <Link href={`/my/orders/${order.orderNo}`}>예약 상세 보기</Link>
        </Button>
        {order.tripId && (
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-md px-6 text-base font-semibold"
          >
            <Link href={`/my?tab=planner&trip=${order.tripId}`}>일정 플래너 열기</Link>
          </Button>
        )}
        <Button asChild variant="ghost" className="h-12 rounded-md px-6 text-base">
          <Link href="/products">쇼핑 계속하기</Link>
        </Button>
      </div>
    </div>
  );
}
