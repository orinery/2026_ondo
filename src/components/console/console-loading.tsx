import { Skeleton } from "@/components/ui/skeleton";

/** 콘솔 페이지 로딩 화면 (제목 + 탭 + 본문 자리) */
export function ConsoleLoading() {
  return (
    <div
      aria-busy="true"
      role="status"
      aria-label="불러오는 중"
      className="flex flex-col gap-4 px-4 py-8 md:px-8 md:py-10"
    >
      <Skeleton className="h-5 w-24 rounded-sm" />
      <Skeleton className="h-9 w-48 rounded-sm" />
      <Skeleton className="mt-4 h-12 w-full max-w-xl rounded-md" />
      <Skeleton className="mt-2 h-64 w-full rounded-lg" />
    </div>
  );
}
