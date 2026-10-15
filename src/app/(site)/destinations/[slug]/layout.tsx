import { notFound } from "next/navigation";

import { getDestinationBySlug } from "@/lib/data/destinations";

/**
 * 없는 여행지 주소에 HTTP 404를 돌려주기 위한 레이아웃.
 *
 * 스트리밍 응답은 시작되는 순간 상태 코드가 200으로 확정된다. 페이지 안에서 notFound()를 부르면
 * 이미 loading.tsx(Suspense)로 응답이 시작된 뒤라 404가 될 수 없다.
 * 레이아웃은 이 경로의 loading.tsx 바깥에 있으므로, 여기서 먼저 확인하면 응답 시작 전에 404가 결정된다.
 * 상위 경로의 loading.tsx는 라우트 그룹((home), (list))으로 옮겨 이 레이아웃을 감싸지 않게 했다.
 *
 * getDestinationBySlug는 cache()로 감싸져 있어 페이지에서 다시 조회하지 않는다.
 */
export default async function DestinationLayout({
  params,
  children,
}: LayoutProps<"/destinations/[slug]">) {
  const { slug } = await params;
  if (!(await getDestinationBySlug(slug))) notFound();
  return children;
}
