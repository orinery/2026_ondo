import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-view";
import { requireUser } from "@/lib/auth";
import { getCartItems } from "@/lib/data/cart";

export const metadata: Metadata = {
  title: "장바구니",
  robots: { index: false, follow: false },
};

/** 장바구니 (보호된 페이지 — proxy가 1차로 막고, 여기서 다시 확인) */
export default async function CartPage() {
  await requireUser("/cart");
  const items = await getCartItems();

  return (
    // 1023 이하: 하단 고정 주문 바(+360 하단 탭)에 내용이 가려지지 않게 여백
    <div className="container flex flex-col gap-8 pt-10 pb-28 md:pt-14 lg:pb-section">
      <header>
        <p className="font-display text-2xl text-muted-foreground italic">Cart</p>
        <h1 className="font-kr text-4xl font-semibold">
          장바구니 <span className="text-muted-foreground">{items.length}</span>
        </h1>
      </header>
      <CartView items={items} />
    </div>
  );
}
