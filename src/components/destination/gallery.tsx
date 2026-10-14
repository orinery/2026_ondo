"use client";

import { ChevronLeftIcon, ChevronRightIcon, ImageIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useCallback, useState, useSyncExternalStore } from "react";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GalleryImage } from "@/types/destination";

type GalleryProps = {
  images: GalleryImage[];
  title: string; // 라이트박스 제목 (스크린리더용)
  // 디자인 QA 전용: 두 번째 타일을 hover 상태로 고정
  previewHoverTile?: boolean;
};

/**
 * 여행지 갤러리 (명세 5.3 · Carousel(embla) + Dialog)
 * - 768 이상: 7+5 bento (큰 사진 1 + 작은 사진 2), 타일 클릭 → 라이트박스
 * - 767 이하: 풀폭 캐러셀 + "1 / N" 카운터
 * - 사진 1장: 화살표·카운터 숨김, "사진 보기" 버튼 비활성 (disabled)
 * - 사진 0장: 16:9 플레이스홀더 (empty)
 */
export function Gallery({ images, title, previewHoverTile }: GalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return <GalleryEmpty />;

  const single = images.length === 1;
  const open = (index: number) => setLightboxIndex(index);

  return (
    <>
      {/* 767 이하: 풀폭 캐러셀 */}
      <MobileCarousel images={images} onOpen={open} />

      {/* 768 이상: bento */}
      <div
        className={cn(
          "hidden aspect-hero gap-2 md:grid",
          single ? "grid-cols-1" : "grid-cols-[7fr_5fr] grid-rows-2",
        )}
      >
        {images.slice(0, 3).map((image, i) => {
          const isLarge = i === 0;
          const isLastVisible = i === Math.min(images.length, 3) - 1;
          return (
            <div
              key={image.src}
              className={cn(
                "relative overflow-hidden bg-muted",
                single && "rounded-lg",
                !single && isLarge && "row-span-2 rounded-l-lg rounded-r-sm",
                // 사진이 2장이면 오른쪽 타일이 두 줄을 모두 차지한다
                images.length === 2 && i === 1 && "row-span-2 rounded-l-sm rounded-r-lg",
                images.length >= 3 && i === 1 && "rounded-sm rounded-tr-lg",
                images.length >= 3 && i === 2 && "rounded-sm rounded-br-lg",
              )}
            >
              <button
                type="button"
                onClick={() => open(i)}
                data-preview={previewHoverTile && i === 1 ? "hover" : undefined}
                className="group absolute inset-0 cursor-zoom-in focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                aria-label={`${image.alt} 크게 보기`}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes={
                    isLarge ? "(min-width: 1280px) 700px, 58vw" : "(min-width: 1280px) 500px, 42vw"
                  }
                  placeholder={image.blurDataURL ? "blur" : "empty"}
                  blurDataURL={image.blurDataURL}
                  priority={isLarge}
                  className="object-cover transition-[filter] duration-fast group-hover:brightness-90 preview-hover:brightness-90"
                />
              </button>
              {isLastVisible && (
                <button
                  type="button"
                  onClick={() => open(0)}
                  disabled={single}
                  className="absolute right-2.5 bottom-2.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-900 shadow-sm transition-opacity hover:bg-stone-100 disabled:opacity-60"
                >
                  {single ? "사진 보기" : `사진 ${images.length}장 보기`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Lightbox
        images={images}
        title={title}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}

/** 767 이하 풀폭 캐러셀 — 스와이프는 embla가 처리한다 */
function MobileCarousel({
  images,
  onOpen,
}: {
  images: GalleryImage[];
  onOpen: (i: number) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const current = useSelectedIndex(api);

  return (
    <Carousel setApi={setApi} className="-mx-5 md:hidden" aria-label="여행지 사진">
      <CarouselContent className="ml-0">
        {images.map((image, i) => (
          <CarouselItem key={image.src} className="pl-0">
            <button
              type="button"
              onClick={() => onOpen(i)}
              className="block w-full"
              aria-label={`${image.alt} 크게 보기`}
            >
              <AspectRatio ratio={3 / 2} className="bg-muted">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="100vw"
                  placeholder={image.blurDataURL ? "blur" : "empty"}
                  blurDataURL={image.blurDataURL}
                  priority={i === 0}
                  className="object-cover"
                />
              </AspectRatio>
            </button>
          </CarouselItem>
        ))}
      </CarouselContent>
      {images.length > 1 && (
        <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-stone-900/70 px-2.5 py-1 text-xs font-medium text-white tabular-nums">
          {current + 1} / {images.length}
        </span>
      )}
    </Carousel>
  );
}

/**
 * 라이트박스 (명세 5.3 active)
 * - 배경 stone-900/92, ← → 키 · 스와이프, 썸네일 스트립 선택 링
 * - Dialog가 focus trap과 Esc 닫기를 제공한다
 * - aria-live로 "3 / 24"를 안내한다
 */
function Lightbox({
  images,
  title,
  index,
  onClose,
}: {
  images: GalleryImage[];
  title: string;
  index: number | null;
  onClose: () => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const current = useSelectedIndex(api);
  const single = images.length === 1;

  return (
    <Dialog open={index !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-stone-900/92 supports-backdrop-filter:backdrop-blur-none"
        // 기본 Dialog의 가운데 정렬 박스를 풀스크린으로 바꾼다
        className="top-0 left-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-transparent p-0 text-white ring-0 sm:max-w-none"
        onKeyDown={(e) => {
          // 포커스가 닫기 버튼 등에 있어도 ← →로 넘길 수 있게 한다
          if (e.key === "ArrowLeft") api?.scrollPrev();
          if (e.key === "ArrowRight") api?.scrollNext();
        }}
      >
        <DialogTitle className="sr-only">{title} 사진</DialogTitle>
        <DialogDescription className="sr-only">
          좌우 화살표 키로 사진을 넘길 수 있어요.
        </DialogDescription>

        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <p aria-live="polite" className={cn("text-sm tabular-nums", single && "invisible")}>
            {current + 1} / {images.length}
          </p>
          <DialogClose className="grid size-11 place-items-center rounded-full hover:bg-white/10">
            <XIcon aria-hidden className="size-5" />
            <span className="sr-only">닫기</span>
          </DialogClose>
        </div>

        <Carousel
          setApi={setApi}
          opts={{ startIndex: index ?? 0 }}
          // shadcn CarouselContent의 바깥 뷰포트(div)에는 className을 줄 수 없어 자식 선택자로 높이를 채운다
          className="relative min-h-0 flex-1 [&>[data-slot=carousel-content]]:h-full"
          aria-label={`${title} 사진`}
        >
          <CarouselContent className="ml-0 h-full">
            {images.map((image) => (
              <CarouselItem key={image.src} className="relative h-full pl-0">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="100vw"
                  className="object-contain"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {!single && (
            <>
              <LightboxArrow direction="prev" onClick={() => api?.scrollPrev()} />
              <LightboxArrow direction="next" onClick={() => api?.scrollNext()} />
            </>
          )}
        </Carousel>

        {!single && (
          <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 py-4">
            {images.map((image, i) => (
              <button
                key={image.src}
                type="button"
                onClick={() => api?.scrollTo(i)}
                aria-label={`${i + 1}번째 사진 보기`}
                aria-current={i === current || undefined}
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden rounded-sm opacity-60 transition-opacity hover:opacity-100",
                  i === current &&
                    "opacity-100 ring-2 ring-white ring-offset-2 ring-offset-stone-900",
                )}
              >
                <Image src={image.src} alt="" fill sizes="56px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LightboxArrow({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "이전 사진" : "다음 사진"}
      className={cn(
        // 터치 기기에서는 스와이프로 넘기므로 화살표를 숨긴다
        "absolute top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20 md:grid",
        direction === "prev" ? "left-4" : "right-4",
      )}
    >
      <Icon aria-hidden className="size-6" />
    </button>
  );
}

/**
 * embla의 현재 슬라이드 번호를 구독한다.
 * embla는 React 바깥의 상태(외부 스토어)이므로 useSyncExternalStore로 읽는다.
 * 왜: effect 안에서 setState로 복사하면 렌더가 한 번 더 일어나고, 값이 어긋나는 순간이 생긴다.
 */
function useSelectedIndex(api: CarouselApi) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!api) return () => {};
      api.on("select", onChange);
      api.on("reInit", onChange);
      return () => {
        api.off("select", onChange);
        api.off("reInit", onChange);
      };
    },
    [api],
  );

  return useSyncExternalStore(
    subscribe,
    () => api?.selectedScrollSnap() ?? 0,
    () => 0, // 서버 렌더 시에는 첫 장
  );
}

/** Empty: 단일 16:9 플레이스홀더 (명세 5.3 empty) */
export function GalleryEmpty() {
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg bg-muted text-muted-foreground">
      <ImageIcon aria-hidden className="size-8" />
      <p className="text-sm">아직 사진이 준비되지 않았어요</p>
    </div>
  );
}

/** Loading: 타일별 muted 배경 (명세 5.3 loading) — 페이지 loading.tsx에서 사용 */
export function GallerySkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="-mx-5 aspect-tile rounded-none md:hidden" />
      <div className="hidden aspect-hero grid-cols-[7fr_5fr] grid-rows-2 gap-2 md:grid">
        <Skeleton className="row-span-2 rounded-l-lg rounded-r-sm" />
        <Skeleton className="rounded-sm rounded-tr-lg" />
        <Skeleton className="rounded-sm rounded-br-lg" />
      </div>
    </div>
  );
}
