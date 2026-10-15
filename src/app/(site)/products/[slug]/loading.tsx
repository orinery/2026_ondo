import { GallerySkeleton } from "@/components/product/gallery";
import { TimelineSkeleton } from "@/components/itinerary/timeline-parts";
import { Skeleton } from "@/components/ui/skeleton";

/** 상세 로딩: 실제 레이아웃과 같은 자리에 스켈레톤을 둬서 레이아웃 이동(CLS)을 줄인다 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      role="status"
      aria-label="상품 불러오는 중"
      className="container pt-8 pb-section md:pt-10"
    >
      <Skeleton className="h-4 w-48 rounded-sm" />
      <Skeleton className="mt-2 h-10 w-64 rounded-sm" />
      <div className="mt-6">
        <GallerySkeleton />
      </div>
      <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <Skeleton className="h-7 w-24 rounded-sm" />
          <Skeleton className="h-20 w-full rounded-md" />
          <div className="mt-8">
            <TimelineSkeleton />
          </div>
        </div>
        <Skeleton className="aspect-square rounded-lg lg:col-span-4 lg:aspect-4/3" />
      </div>
    </div>
  );
}
