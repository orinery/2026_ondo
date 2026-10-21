import { ReceiptTextIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { OrderSummary } from "@/lib/data/orders";
import { formatKrw, formatUseDate } from "@/lib/format";
import { STATUS_FILTERS, type DisplayStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

import { ItemStatusBadge, OrderStatusBadge } from "./order-status-badge";

const paidDate = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" });

/**
 * 나의 여행 > 예약 내역 (하이파이에 없는 쇼핑몰 화면 — 기존 토큰·컴포넌트로 구성)
 * 상태 필터는 URL(?tab=orders&status=)과 동기화한다.
 */
export function OrderList({
  orders,
  status,
  label = "예약 내역",
}: {
  orders: OrderSummary[];
  status: DisplayStatus | "all";
  label?: string; // 한 화면에 두 번 쓸 때(쇼케이스) 랜드마크 이름이 겹치지 않게
}) {
  const visible = status === "all" ? orders : orders.filter((o) => o.displayStatus === status);

  return (
    <section aria-label={label} className="flex flex-col gap-6">
      <nav aria-label={`${label} 상태`} className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? orders.length
              : orders.filter((o) => o.displayStatus === f.value).length;
          const active = status === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === "all" ? "/my?tab=orders" : `/my?tab=orders&status=${f.value}`}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "my-0.5 flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-medium transition-colors duration-fast hover:bg-muted",
                active && "border-foreground bg-foreground text-background hover:bg-foreground",
              )}
            >
              {f.label} <span className="ml-1 tabular-nums opacity-70">{count}</span>
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-input px-6 py-16 text-center">
          <ReceiptTextIcon aria-hidden className="size-6 text-muted-foreground" />
          <p className="font-semibold">
            {orders.length === 0 ? "아직 예약한 상품이 없어요" : "이 상태의 예약이 없어요"}
          </p>
          {orders.length === 0 && (
            <Link href="/products" className="text-sm font-semibold text-primary hover:underline">
              상품 둘러보기 →
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((order) => (
            <li key={order.id} className="rounded-lg border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <p className="flex items-center gap-2 text-sm">
                  <OrderStatusBadge status={order.displayStatus} />
                  <span className="text-muted-foreground">
                    {paidDate.format(new Date(order.paidAt))} 결제
                  </span>
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">{order.orderNo}</p>
              </div>
              <ul className="flex flex-col divide-y">
                {order.items.map((item) => (
                  <li key={item.id} className="flex gap-3 px-4 py-3">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-kr font-semibold">{item.productTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatUseDate(item.useDate)}
                        {item.startTime && ` ${item.startTime}`} · {item.adultQty + item.childQty}명
                      </p>
                    </div>
                    {/* 한 주문에 상태가 다른 항목이 섞일 수 있어(부분 취소·확정 대기) 항목마다 표시 */}
                    {order.items.length > 1 && (
                      <ItemStatusBadge status={item.displayStatus} className="self-center" />
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
                <p className="text-base font-semibold">
                  {formatKrw(order.totalAmount)}
                  {(order.refundAmount ?? 0) > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      환불 {formatKrw(order.refundAmount ?? 0)}
                    </span>
                  )}
                </p>
                <Link
                  href={`/my/orders/${order.orderNo}`}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  상세 보기<span className="sr-only"> ({order.orderNo})</span> →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
