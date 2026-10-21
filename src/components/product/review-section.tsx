import { BadgeCheckIcon, MessageSquareTextIcon } from "lucide-react";
import Image from "next/image";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ReviewItem } from "@/lib/data/products";

import { ReviewReportDialog } from "./review-report-dialog";

type ReviewSectionProps = {
  rating: number;
  reviewCount: number;
  reviews: ReviewItem[];
  distribution: { star: number; count: number }[];
  // 리뷰 쓰기/수정 버튼 (ReviewDialog)
  action?: React.ReactNode;
  currentUserId?: string | null; // 내 리뷰에 "내 리뷰" 표시
};

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** 상세 "리뷰" (명세 4.3: 요약 + 리스트) */
export function ReviewSection({
  rating,
  reviewCount,
  reviews,
  distribution,
  action,
  currentUserId,
}: ReviewSectionProps) {
  return (
    <section aria-labelledby="reviews-title" className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <h2 id="reviews-title" className="font-kr text-2xl font-semibold">
          리뷰 <span className="text-muted-foreground">{reviewCount}</span>
        </h2>
        {action}
      </div>

      {reviewCount === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border-[1.5px] border-dashed border-input px-6 py-12 text-center">
          <MessageSquareTextIcon aria-hidden className="size-6 text-muted-foreground" />
          <p className="font-semibold">아직 리뷰가 없어요</p>
          <p className="text-sm text-muted-foreground">이용을 마치셨다면 첫 리뷰를 남겨 주세요.</p>
        </div>
      ) : (
        <>
          {/* 요약: 평균 + 별점 분포 */}
          <div className="flex flex-col gap-6 rounded-lg border bg-card p-6 sm:flex-row sm:items-center">
            <div className="flex flex-col items-center gap-1 sm:w-36">
              <p className="text-4xl font-semibold tabular-nums">{rating.toFixed(1)}</p>
              <Stars rating={Math.round(rating)} />
              <p className="text-sm text-muted-foreground">리뷰 {reviewCount}개</p>
            </div>
            <ul className="flex flex-1 flex-col gap-1.5" aria-label="별점 분포">
              {distribution.map(({ star, count }) => {
                const ratio = reviewCount ? count / reviewCount : 0;
                return (
                  <li key={star} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-muted-foreground tabular-nums">{star}점</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      {/* 비율은 데이터에서 계산되는 값이라 인라인 스타일(폭)로만 표현한다 */}
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </span>
                    <span className="w-6 text-right text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="flex flex-col divide-y">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 py-6 first:pt-0">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    {r.author.avatarUrl && <AvatarImage src={r.author.avatarUrl} alt="" />}
                    <AvatarFallback>{r.author.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {r.author.name}
                      {/* 리뷰는 이용을 마친 구매 고객만 쓸 수 있다 (DB 정책) → 모든 리뷰가 구매 인증 */}
                      <span className="inline-flex items-center gap-0.5 rounded-sm border px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <BadgeCheckIcon aria-hidden className="size-3" />
                        구매 인증
                      </span>
                      {r.userId === currentUserId && (
                        <span className="rounded-sm bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                          내 리뷰
                        </span>
                      )}
                      {r.hidden && (
                        // 숨긴 리뷰는 작성자(와 관리자)에게만 보인다 — 왜 남에게 안 보이는지 알려 준다
                        <span className="rounded-sm border border-warning/50 px-1.5 py-0.5 text-xs font-medium text-warning">
                          숨김 처리됨 · 다른 사람에게 보이지 않아요
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={r.createdAt}>{dateFormat.format(new Date(r.createdAt))}</time>
                    </p>
                  </div>
                  <Stars rating={r.rating} className="ml-auto" />
                </div>
                {/* 로그인한 사용자가 남의 리뷰를 신고할 수 있다 */}
                {currentUserId && r.userId !== currentUserId && !r.hidden && (
                  <div className="-mt-2 flex justify-end">
                    <ReviewReportDialog reviewId={r.id} authorName={r.author.name} />
                  </div>
                )}
                <p className="text-base whitespace-pre-line">{r.content}</p>
                {r.photoUrl && (
                  <div className="relative size-40 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={r.photoUrl}
                      alt={`${r.author.name}님이 올린 여행 사진`}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={className}>
      <span aria-hidden className="tracking-tight">
        <span className="text-foreground">{"★".repeat(rating)}</span>
        <span className="text-input">{"★".repeat(5 - rating)}</span>
      </span>
      <span className="sr-only">5점 만점에 {rating}점</span>
    </span>
  );
}
