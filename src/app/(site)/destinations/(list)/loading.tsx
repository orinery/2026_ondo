import {
  DestinationCardSkeleton,
  DestinationGrid,
} from "@/components/destination/destination-card";
import { Skeleton } from "@/components/ui/skeleton";

/** 목록 첫 로딩: 제목·필터 바 자리 + 카드 스켈레톤 8개 (명세 4.2 상태) */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="여행지 불러오는 중">
      <div className="container pt-10 md:pt-14">
        <Skeleton className="h-6 w-24 rounded-sm" />
        <Skeleton className="mt-2 h-10 w-56 rounded-sm" />
      </div>
      <div className="mt-6 border-b">
        <div className="container flex flex-col gap-4 py-4 lg:pt-6 lg:pb-5">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="hidden h-10 w-96 rounded-full lg:block" />
        </div>
      </div>
      <div className="container pt-8 pb-24">
        <DestinationGrid>
          {Array.from({ length: 8 }, (_, i) => (
            <DestinationCardSkeleton key={i} />
          ))}
        </DestinationGrid>
      </div>
    </div>
  );
}
