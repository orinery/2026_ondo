import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getOrderByNo } from "@/lib/data/orders";

/**
 * 주문 완료 — 없는 주문번호·남의 주문(RLS로 조회되지 않음)은 HTTP 404.
 * 응답이 시작되기 전에 판정하려고 레이아웃에서 확인한다 (상품 상세 [slug]/layout.tsx와 같은 이유).
 */
export default async function OrderCompleteLayout({
  params,
  children,
}: LayoutProps<"/checkout/complete/[orderNo]">) {
  const { orderNo } = await params;
  await requireUser(`/checkout/complete/${orderNo}`);
  if (!(await getOrderByNo(orderNo))) notFound();
  return children;
}
