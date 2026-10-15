import { HeartIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { seasonLabel, themeLabel } from "@/lib/constants/taxonomy";
import { cn } from "@/lib/utils";
import type { DestinationSummary } from "@/types/destination";

import { LikeButton } from "./like-button";

type DestinationCardProps = {
  destination: DestinationSummary;
  initialLiked?: boolean;
  showReviewCount?: boolean; // 목록: true, 메인 추천: false (명세 하이파이)
  priority?: boolean; // 첫 화면에 보이는 카드만 true (LCP 최적화)
  sizes?: string;
  // 디자인 QA 전용 (/dev/components): hover·focus 상태를 정지 화면으로 보여준다
  previewState?: "hover" | "focus";
  // "local": 찜을 서버에 저장하지 않는 데모 모드 (/dev/components)
  likeMode?: "server" | "local";
  // 카드 하단 추가 영역 (예: 나의 여행의 "폴더 이동" 메뉴)
  footer?: React.ReactNode;
};

const numberFormat = new Intl.NumberFormat("ko-KR");

/**
 * 여행지 카드 (명세 5.1 · shadcn Card 대신 article + AspectRatio)
 *
 * 구조: 카드 전체가 클릭 영역이지만 실제 링크는 여행지명 하나다.
 * 링크의 ::after를 카드 전체로 늘리는 "stretched link" 패턴을 써서
 * 링크 안에 찜 버튼이 중첩되는 문제(인터랙티브 요소 중첩)를 피한다.
 */
export function DestinationCard({
  destination: d,
  initialLiked = false,
  showReviewCount = true,
  priority = false,
  sizes = "(min-width: 1280px) 300px, (min-width: 768px) 50vw, 100vw",
  previewState,
  likeMode = "server",
  footer,
}: DestinationCardProps) {
  const disabled = Boolean(d.unavailableReason);

  return (
    <article
      data-preview={previewState}
      // 비활성(명세 5.1 Disabled): 명세는 카드 전체 opacity 55%지만, 글자 대비가 2.47로 떨어져
      // 사진에만 opacity·흑백을 주고 글자는 muted-foreground로 읽을 수 있게 둔다 (8단계 점검, 사용자 확정)
      className="group relative flex flex-col gap-3.5"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-muted ring-offset-2 ring-offset-background transition-[translate,box-shadow] duration-base ease-out-soft",
          // Hover: lift -4px + shadow-md. reduced-motion에서는 shadow만 (명세 5.1 Hover)
          !disabled && "group-hover:shadow-md motion-safe:group-hover:-translate-y-1",
          !disabled && "preview-hover:shadow-md motion-safe:preview-hover:-translate-y-1",
          // Active: 링크에 키보드 포커스가 오면 이미지에 2px 링 + 2px 오프셋
          "group-has-[a:focus-visible]:ring-2 group-has-[a:focus-visible]:ring-ring preview-focus:ring-2 preview-focus:ring-ring",
        )}
      >
        <AspectRatio ratio={4 / 5}>
          <Image
            src={d.imageUrl}
            alt={d.imageAlt}
            fill
            sizes={sizes}
            priority={priority}
            className={cn(
              "object-cover transition-transform duration-slow ease-out-soft",
              !disabled && "motion-safe:group-hover:scale-104 motion-safe:preview-hover:scale-104",
              disabled && "opacity-55 grayscale",
            )}
          />
        </AspectRatio>

        <span className="absolute top-3 left-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-900">
          {seasonLabel(d.season)}
        </span>

        {disabled ? (
          <span className="absolute bottom-2 left-2 rounded-sm bg-stone-900 px-2 py-1 text-xs font-semibold text-white">
            {d.unavailableReason}
          </span>
        ) : (
          // z-10: stretched link(::after)보다 위에 있어야 클릭된다
          <LikeButton
            destinationId={d.id}
            destinationName={d.name}
            initialLiked={initialLiked}
            mode={likeMode}
            className="absolute top-2.5 right-2.5 z-10"
          />
        )}
      </div>

      <div>
        <p className="text-sm text-muted-foreground">
          {d.country} · {themeLabel(d.theme)}
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h3 className="flex min-w-0 items-baseline gap-2">
            {disabled ? (
              <span className="truncate font-kr text-lg font-semibold text-muted-foreground xl:text-xl">
                {d.name}
              </span>
            ) : (
              <Link
                href={`/destinations/${d.slug}`}
                className={cn(
                  "truncate font-kr text-lg font-semibold underline-offset-3 outline-none xl:text-xl",
                  "after:absolute after:inset-0 after:content-['']",
                  "group-hover:underline preview-hover:underline",
                  // 포커스 표시는 이미지 링으로 대신하므로 전역 :focus-visible 그림자는 끈다
                  "focus-visible:shadow-none",
                )}
              >
                {d.name}
              </Link>
            )}
            <span className="font-display text-lg whitespace-nowrap text-muted-foreground xl:text-xl">
              {d.nameEn}
            </span>
          </h3>
          <span className="text-sm whitespace-nowrap text-foreground">
            <span aria-hidden>★</span>
            <span className="sr-only">평점</span> {d.rating.toFixed(1)}
            {showReviewCount && (
              <span className="text-muted-foreground"> ({numberFormat.format(d.reviewCount)})</span>
            )}
          </span>
        </div>
        {/* z-10: stretched link 위에 있어야 클릭된다 */}
        {footer && <div className="relative z-10 mt-2">{footer}</div>}
      </div>
    </article>
  );
}

/** Loading: 같은 4:5 비율을 유지해 레이아웃 이동(CLS)이 없게 한다 (명세 5.1 Loading) */
export function DestinationCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="aspect-card w-full rounded-lg" />
      <Skeleton className="h-3 w-[45%] rounded-sm" />
      <Skeleton className="h-4.5 w-3/4 rounded-sm" />
    </div>
  );
}

type DestinationCardEmptyProps = {
  message?: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
};

/** Empty: 점선 보더 + 안내 문구 + 다음 행동 링크 1개 (명세 5.1 Empty) */
export function DestinationCardEmpty({
  message = (
    <>
      아직 찜한
      <br />
      여행지가 없어요
    </>
  ),
  actionLabel = "둘러보기 →",
  actionHref = "/destinations",
}: DestinationCardEmptyProps) {
  return (
    <div className="flex aspect-card flex-col items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-input p-4 text-center">
      <HeartIcon aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm text-foreground">{message}</p>
      <Link href={actionHref} className="text-sm font-semibold text-primary hover:underline">
        {actionLabel}
      </Link>
    </div>
  );
}

/** 카드 그리드 (명세 5.1 Grid: 360 1열 · 768 2열 · 1280 4열, gap 24 / row-gap 40) */
export function DestinationGrid({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-4", className)}
      {...props}
    />
  );
}
