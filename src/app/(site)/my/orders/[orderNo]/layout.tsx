import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { expirePendingItems, getOrderByNo } from "@/lib/data/orders";

/**
 * 예약 상세 — 없는 주문번호·남의 주문(RLS로 조회되지 않음)은 HTTP 404.
 * 응답이 시작되기 전에 판정하려고 레이아웃에서 확인한다. 나의 여행 로딩 화면은 라우트 그룹 (tabs)로 옮겨
 * 이 레이아웃을 감싸지 않게 했다 (상품 상세와 같은 이유).
 */
export default async function OrderLayout({
  params,
  children,
}: LayoutProps<"/my/orders/[orderNo]">) {
  const { orderNo } = await params;
  await requireUser(`/my/orders/${orderNo}`);
  // 기한 지난 확정 대기를 먼저 정리해야 상태(기한 초과 취소)가 바로 보인다
  await expirePendingItems();
  if (!(await getOrderByNo(orderNo))) notFound();
  return children;
}
