import { Skeleton } from "@/components/ui/skeleton";

/**
 * 주문서 로딩. 라우트 그룹 (form) 안에 두어 주문서만 감싼다 —
 * checkout 바로 아래에 두면 주문 완료(/checkout/complete/[orderNo])의 레이아웃까지 감싸서 404 판정보다 응답이 먼저 시작된다.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="주문서 불러오는 중"
      className="container flex flex-col gap-8 py-10 md:py-14"
    >
      <div>
        <Skeleton className="h-7 w-28 rounded-sm" />
        <Skeleton className="mt-2 h-10 w-36 rounded-sm" />
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <Skeleton className="h-72 rounded-xl lg:col-span-4" />
      </div>
    </div>
  );
}
