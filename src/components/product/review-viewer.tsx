"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useViewer } from "@/components/viewer/viewer-provider";
import type { ViewerReview } from "@/lib/viewer";

import { ReviewDialog } from "./review-dialog";
import { ReviewReportDialog } from "./review-report-dialog";

/**
 * 리뷰 영역에서 사람마다 다른 부분 (S2) — 상품 상세는 캐시된 공용 HTML이라 브라우저에서 채운다.
 * currentUserId를 직접 넘기면(디자인 쇼케이스) 그 값을, 아니면 /api/me의 로그인 사용자를 쓴다.
 */
function useCurrentUserId(override: string | null | undefined) {
  const { user } = useViewer();
  return override !== undefined ? override : (user?.id ?? null);
}

/** "내 리뷰" 표시 */
export function OwnReviewBadge({
  authorId,
  currentUserId,
}: {
  authorId: string;
  currentUserId?: string | null;
}) {
  const me = useCurrentUserId(currentUserId);
  if (!me || me !== authorId) return null;
  return (
    <span className="rounded-sm bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
      내 리뷰
    </span>
  );
}

/** 로그인한 사용자가 남의 리뷰를 신고하는 버튼 */
export function ReviewReportSlot({
  reviewId,
  authorId,
  authorName,
  hidden,
  currentUserId,
}: {
  reviewId: string;
  authorId: string;
  authorName: string;
  hidden: boolean;
  currentUserId?: string | null;
}) {
  const me = useCurrentUserId(currentUserId);
  if (!me || me === authorId || hidden) return null;
  return (
    <div className="-mt-2 flex justify-end">
      <ReviewReportDialog reviewId={reviewId} authorName={authorName} />
    </div>
  );
}

/**
 * 리뷰 쓰기·수정 버튼 — 로그인했으면 /api/me/review로 "내 리뷰"와 "쓸 수 있는지"를 묻는다.
 * 리뷰를 저장하면 ReviewDialog가 refresh()를 불러 다시 묻는다(새 리뷰 → 수정 모드).
 */
export function ViewerReviewAction({
  productId,
  slug,
  productTitle,
}: {
  productId: string;
  slug: string;
  productTitle: string;
}) {
  const { status, user, version } = useViewer();
  const [result, setResult] = useState<{ key: string; data: ViewerReview } | null>(null);
  const key = `${user?.id}:${productId}:${version}`;

  useEffect(() => {
    if (!user) return;
    const ctrl = new AbortController();
    fetch(`/api/me/review?product=${productId}`, { signal: ctrl.signal, cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<ViewerReview>) : Promise.reject(res)))
      .then((data) => setResult({ key, data }))
      // 묻지 못하면 쓰기 버튼 대신 안내가 보인다 (쓰더라도 DB가 다시 확인한다)
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ key, data: { canReview: false, myReview: null } });
      });
    return () => ctrl.abort();
  }, [user, productId, key]);

  // 지금 사용자·버전에 맞는 응답이 올 때까지는 자리만 잡아 둔다 (이전 응답으로 그리지 않는다)
  const info = result?.key === key ? result.data : null;
  if (status === "loading" || (user && !info)) {
    return <Skeleton aria-hidden className="h-10 w-32 rounded-md" />;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ReviewDialog
        productId={productId}
        slug={slug}
        productTitle={productTitle}
        userId={user?.id ?? null}
        canReview={info?.canReview ?? false}
        myReview={info?.myReview ?? null}
      />
      {info?.myReview?.hidden && (
        // 숨긴 리뷰는 공개 목록에 없다 — 작성자에게 이유를 알려 준다
        <p className="text-xs text-warning">내 리뷰는 숨김 처리돼 다른 사람에게 보이지 않아요</p>
      )}
    </div>
  );
}
