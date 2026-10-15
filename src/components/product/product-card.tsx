import { HeartIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryLabel, themeLabel } from "@/lib/constants/taxonomy";
import { discountRate, formatKrw } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types/product";

import { LikeButton } from "./like-button";

type ProductCardProps = {
  product: ProductSummary;
  initialLiked?: boolean;
  showReviewCount?: boolean; // 목록: true, 메인 추천: false (명세 하이파이)
  priority?: boolean; // 첫 화면에 보이는 카드만 true (LCP 최적화)
  sizes?: string;
  // 상세로 넘겨 줄 이용일 (목록에서 날짜로 거른 경우 예약 위젯에 미리 선택)
  date?: string | null;
  // 디자인 QA 전용 (/dev/components): hover·focus 상태를 정지 화면으로 보여준다
  previewState?: "hover" | "focus";
  // "local": 찜을 서버에 저장하지 않는 데모 모드 (/dev/components)
  likeMode?: "server" | "local";
  // 카드 하단 추가 영역 (예: 나의 여행의 "폴더 이동" 메뉴)
  footer?: React.ReactNode;
};

const numberFormat = new Intl.NumberFormat("ko-KR");

/**
 * 상품 카드 (명세 5.1 여행지 카드 + 가격 줄 · shadcn Card 대신 article + AspectRatio)
 *
 * 구조: 카드 전체가 클릭 영역이지만 실제 링크는 상품명 하나다.
 * 링크의 ::after를 카드 전체로 늘리는 "stretched link" 패턴을 써서
 * 링크 안에 찜 버튼이 중첩되는 문제(인터랙티브 요소 중첩)를 피한다.
 */
export function ProductCard({
  product: p,
  initialLiked = false,
  showReviewCount = true,
  priority = false,
  sizes = "(min-width: 1280px) 300px, (min-width: 768px) 50vw, 100vw",
  date,
  previewState,
  likeMode = "server",
  footer,
}: ProductCardProps) {
  const disabled = Boolean(p.unavailableReason);
  const discount = discountRate(p.adultPrice, p.listAdultPrice);
  const href = date ? `/products/${p.slug}?date=${date}` : `/products/${p.slug}`;

  return (
    <article data-preview={previewState} className="group relative flex flex-col gap-3.5">
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
            src={p.imageUrl}
            alt={p.imageAlt}
            fill
            sizes={sizes}
            priority={priority}
            className={cn(
              "object-cover transition-transform duration-slow ease-out-soft",
              !disabled && "motion-safe:group-hover:scale-104 motion-safe:preview-hover:scale-104",
              // 비활성(명세 5.1 Disabled): 글자 대비를 지키기 위해 사진에만 opacity·흑백 (8단계 사용자 확정)
              disabled && "opacity-55 grayscale",
            )}
          />
        </AspectRatio>

        {/* 흰 배지 (2단계 사용자 확정) — 여행지 카드의 시즌 배지 자리에 상품 종류를 표시 */}
        <span className="absolute top-3 left-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-900">
          {categoryLabel(p.category)}
        </span>

        {disabled ? (
          <span className="absolute bottom-2 left-2 rounded-sm bg-stone-900 px-2 py-1 text-xs font-semibold text-white">
            {p.unavailableReason}
          </span>
        ) : (
          // z-10: stretched link(::after)보다 위에 있어야 클릭된다
          <LikeButton
            productId={p.id}
            productTitle={p.title}
            initialLiked={initialLiked}
            mode={likeMode}
            className="absolute top-2.5 right-2.5 z-10"
          />
        )}
      </div>

      <div>
        <p className="text-sm text-muted-foreground">
          {p.city.name}
          <span className="font-display"> {p.city.nameEn}</span> · {themeLabel(p.theme)}
        </p>
        <h3 className="mt-1">
          {disabled ? (
            <span className="line-clamp-2 font-kr text-lg font-semibold text-muted-foreground">
              {p.title}
            </span>
          ) : (
            <Link
              href={href}
              className={cn(
                "line-clamp-2 font-kr text-lg font-semibold underline-offset-3 outline-none",
                "after:absolute after:inset-0 after:content-['']",
                "group-hover:underline preview-hover:underline",
                // 포커스 표시는 이미지 링으로 대신하므로 전역 :focus-visible 그림자는 끈다
                "focus-visible:shadow-none",
              )}
            >
              {p.title}
            </Link>
          )}
        </h3>
        {/* 리뷰가 없으면 "★ 0.0" 대신 아직 리뷰가 없다고 알린다 (평점 0은 낮은 평점처럼 보인다) */}
        {p.reviewCount === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">아직 리뷰가 없어요</p>
        ) : (
          <p className="mt-1 text-sm text-foreground">
            <span aria-hidden>★</span>
            <span className="sr-only">평점</span> {p.rating.toFixed(1)}
            {showReviewCount && (
              <span className="text-muted-foreground">
                {" "}
                (리뷰 {numberFormat.format(p.reviewCount)})
              </span>
            )}
          </p>
        )}
        <p
          className={cn(
            "mt-2 flex flex-wrap items-baseline gap-x-1.5",
            disabled && "text-muted-foreground",
          )}
        >
          {discount !== null && !disabled && (
            <span className="text-base font-semibold text-destructive">
              {discount}%<span className="sr-only"> 할인</span>
            </span>
          )}
          <span className="text-lg font-semibold">{formatKrw(p.adultPrice)}</span>
          {p.listAdultPrice && !disabled && (
            <s className="text-sm text-muted-foreground">
              <span className="sr-only">정가 </span>
              {formatKrw(p.listAdultPrice)}
            </s>
          )}
          <span className="text-xs text-muted-foreground">성인 1인</span>
        </p>
        {/* z-10: stretched link 위에 있어야 클릭된다 */}
        {footer && <div className="relative z-10 mt-2">{footer}</div>}
      </div>
    </article>
  );
}

/** Loading: 같은 4:5 비율을 유지해 레이아웃 이동(CLS)이 없게 한다 (명세 5.1 Loading) */
export function ProductCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="aspect-card w-full rounded-lg" />
      <Skeleton className="h-3 w-[45%] rounded-sm" />
      <Skeleton className="h-4.5 w-3/4 rounded-sm" />
      <Skeleton className="h-5 w-1/2 rounded-sm" />
    </div>
  );
}

type ProductCardEmptyProps = {
  message?: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
};

/** Empty: 점선 보더 + 안내 문구 + 다음 행동 링크 1개 (명세 5.1 Empty) */
export function ProductCardEmpty({
  message = (
    <>
      아직 찜한
      <br />
      상품이 없어요
    </>
  ),
  actionLabel = "둘러보기 →",
  actionHref = "/products",
}: ProductCardEmptyProps) {
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
export function ProductGrid({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-4", className)}
      {...props}
    />
  );
}
