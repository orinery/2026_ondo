import { randomUUID } from "node:crypto";

import { TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TrackEvent } from "@/components/analytics/track-event";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { OrderItemList } from "@/components/checkout/order-item-list";
import { CancellationPolicyTable } from "@/components/product/cancellation-policy-table";
import { requireUser } from "@/lib/auth";
import { getCartItems } from "@/lib/data/cart";
import { getSellers } from "@/lib/data/products";
import { errorMessage } from "@/lib/order-errors";
import { optionLabel } from "@/lib/booking";
import { parseItemsParam } from "@/lib/validation/checkout";

export const metadata: Metadata = {
  title: "주문서",
  robots: { index: false, follow: false },
};

/**
 * 주문서 (/checkout?items=장바구니항목id,...) — 장바구니와 상품 상세의 "바로 구매"가 여기로 온다.
 * 금액은 서버가 현재 가격으로 계산해 보여주고, 결제할 때 DB가 같은 금액인지 다시 확인한다.
 */
export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const user = await requireUser("/cart");
  const ids = parseItemsParam((await searchParams).items);
  if (ids.length === 0) redirect("/cart");

  // RLS로 본인 장바구니 항목만 나온다. 이미 주문했거나(삭제됨) 남의 항목이면 비어 있다
  const items = await getCartItems(ids);
  if (items.length === 0) redirect("/cart");

  const blocked = items.filter((i) => i.error);
  // 판매자별로 묶은 상품명 — 결제 전에 누구와 거래하는지 보여 준다 (통신판매중개 고지, Q3)
  const sellers = await getSellers(items.map((i) => i.product.id));
  const bySeller = new Map<string, string[]>();
  for (const i of items) {
    const name = sellers.get(i.product.id)?.name;
    if (name) bySeller.set(name, [...(bySeller.get(name) ?? []), i.product.title]);
  }
  const total = items.reduce((sum, i) => sum + i.subtotal, 0);
  // 같은 취소 규정을 쓰는 상품끼리 묶어 한 번만 보여준다
  const policies = [...new Map(items.map((i) => [i.product.cancelPolicy.code, i])).values()].map(
    (i) => ({
      policy: i.product.cancelPolicy,
      titles: items
        .filter((x) => x.product.cancelPolicy.code === i.product.cancelPolicy.code)
        .map((x) => x.product.title),
    }),
  );

  const lines = items.map((i) => ({
    id: i.id,
    slug: i.product.slug,
    title: i.product.title,
    cityName: i.product.cityName,
    imageUrl: i.product.imageUrl,
    useDate: i.useDate,
    startTime: i.slot.startTime,
    adultQty: i.adultQty,
    childQty: i.childQty,
    options: i.options.map((o) => optionLabel(o, i.adultQty + i.childQty)),
    subtotal: i.subtotal,
    note: i.error ? (
      <p className="mt-1 inline-flex items-center gap-1 text-sm text-destructive">
        <TriangleAlertIcon aria-hidden className="size-3.5" />
        {errorMessage(i.error)}
      </p>
    ) : undefined,
  }));

  return (
    <div className="container flex flex-col gap-8 py-10 md:py-14">
      <TrackEvent name="begin_checkout" />
      <header>
        <p className="font-display text-2xl text-muted-foreground italic">Checkout</p>
        <h1 className="font-kr text-4xl font-semibold">주문서</h1>
      </header>

      {blocked.length > 0 ? (
        // 담은 뒤 마감·휴무 등으로 예약할 수 없게 된 상품이 있으면 결제하지 않는다
        <div className="flex flex-col gap-6">
          <div role="alert" className="rounded-lg border border-destructive/40 bg-card p-5">
            <p className="font-semibold text-destructive">예약할 수 없는 상품이 있어요</p>
            <p className="mt-1 text-sm text-muted-foreground">
              장바구니에서 해당 상품을 빼거나 날짜를 바꿔 다시 담은 뒤 주문해 주세요.
            </p>
            <Link
              href="/cart"
              className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
            >
              장바구니로 돌아가기 →
            </Link>
          </div>
          <OrderItemList lines={lines} />
        </div>
      ) : (
        <CheckoutForm
          cartItemIds={items.map((i) => i.id)}
          expectedTotal={total}
          idempotencyKey={randomUUID()}
          defaults={{ name: user.displayName, email: user.email ?? "" }}
          itemCount={items.length}
        >
          <section aria-labelledby="items-title" className="flex flex-col gap-4">
            <h2 id="items-title" className="font-kr text-xl font-semibold">
              주문 상품 {items.length}개
            </h2>
            <OrderItemList lines={lines} />
            {bySeller.size > 0 && (
              <div className="rounded-md bg-muted px-4 py-3 text-sm">
                <p className="font-medium">판매자</p>
                <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
                  {[...bySeller].map(([name, titles]) => (
                    <li key={name}>
                      <span className="text-foreground">{name}</span> · {titles.join(", ")}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  여운은 통신판매중개자로서 거래 당사자가 아니며, 상품 정보와 예약 이행의 책임은 각
                  판매자에게 있어요. 판매자 정보는 상품 페이지에서 볼 수 있어요.
                </p>
              </div>
            )}
          </section>

          <section aria-labelledby="policy-title" className="flex flex-col gap-4">
            <h2 id="policy-title" className="font-kr text-xl font-semibold">
              취소 규정
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {policies.map(({ policy, titles }) => (
                <div key={policy.code} className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">적용 상품: {titles.join(", ")}</p>
                  <CancellationPolicyTable
                    name={policy.name}
                    summary={policy.summary}
                    tiers={policy.tiers}
                  />
                </div>
              ))}
            </div>
          </section>
        </CheckoutForm>
      )}
    </div>
  );
}
