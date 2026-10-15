import { Skeleton } from "@/components/ui/skeleton";

/**
 * 메인 로딩 화면.
 * 라우트 그룹 (home) 안에 두어 메인 페이지만 감싼다 — (site) 바로 아래에 두면 모든 하위 경로(상세 포함)의
 * 레이아웃까지 Suspense로 감싸서, 상세의 404 판정보다 응답이 먼저 시작돼 버린다(상세 [slug]/layout.tsx 참고).
 */
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
