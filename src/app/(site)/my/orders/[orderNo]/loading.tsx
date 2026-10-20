import { Skeleton } from "@/components/ui/skeleton";

/** 예약 상세 로딩 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="예약 불러오는 중"
      className="container flex max-w-4xl flex-col gap-8 py-10 md:py-14"
    >
      <Skeleton className="h-5 w-24 rounded-sm" />
      <Skeleton className="h-10 w-64 rounded-sm" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
      </div>
    </div>
  );
}
