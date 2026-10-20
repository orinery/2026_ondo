import { Skeleton } from "@/components/ui/skeleton";

/** 나의 여행 로딩 화면 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      role="status"
      aria-label="불러오는 중"
      className="container flex flex-col gap-4 py-10 md:py-14"
    >
      <Skeleton className="h-6 w-32 rounded-sm" />
      <Skeleton className="h-10 w-64 rounded-sm" />
      <Skeleton className="mt-6 h-64 w-full rounded-lg" />
    </div>
  );
}
