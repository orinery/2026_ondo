import { Skeleton } from "@/components/ui/skeleton";

/** 장바구니 로딩: 제목 + 항목 카드 3개 + 요약 자리 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="장바구니 불러오는 중"
      className="container flex flex-col gap-8 py-10 md:py-14"
    >
      <div>
        <Skeleton className="h-7 w-20 rounded-sm" />
        <Skeleton className="mt-2 h-10 w-44 rounded-sm" />
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="hidden h-64 rounded-xl lg:col-span-4 lg:block" />
      </div>
    </div>
  );
}
