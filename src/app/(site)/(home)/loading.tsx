import { Skeleton } from "@/components/ui/skeleton";

/** 페이지 전환 중 기본 로딩 화면. 개별 페이지는 자기 레이아웃에 맞는 loading.tsx로 덮어쓴다 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="불러오는 중"
      className="container flex flex-col gap-4 py-10 md:py-14"
    >
      <Skeleton className="h-6 w-32 rounded-sm" />
      <Skeleton className="h-10 w-64 rounded-sm" />
      <Skeleton className="mt-6 h-64 w-full rounded-lg" />
    </div>
  );
}
