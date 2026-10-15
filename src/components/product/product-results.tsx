import { CompassIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types/product";

import { ProductCard, ProductCardSkeleton, ProductGrid } from "./product-card";

type ProductResultsProps = {
  items: ProductSummary[];
  likedIds?: ReadonlySet<string>;
  likeMode?: "server" | "local";
  date?: string | null; // 이용일 필터 → 카드 링크로 상세 예약 위젯에 넘긴다
  // 첫 로딩(이전 결과 없음) → 스켈레톤 8개
  isLoading?: boolean;
  // 필터 변경 중(이전 결과 있음) → 이전 결과를 opacity .5로 유지 (명세 5.2 결과 영역 loading)
  isPending?: boolean;
  onReset?: () => void;
  // 빈 결과일 때 "마지막으로 바꾼 필터 해제" 제안 (명세 5.2 empty)
  lastFilter?: { label: string; onClear: () => void } | null;
};

const SKELETON_COUNT = 8;

/** 상품 결과 그리드 + 로딩·빈 상태 (명세 4.2 결과 그리드 · 상태) */
export function ProductResults({
  items,
  likedIds,
  likeMode = "server",
  date,
  isLoading = false,
  isPending = false,
  onReset,
  lastFilter,
}: ProductResultsProps) {
  if (isLoading) {
    return (
      <ProductGrid role="status" aria-busy="true" aria-label="상품 불러오는 중">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </ProductGrid>
    );
  }

  if (items.length === 0) {
    return <ProductResultsEmpty onReset={onReset} lastFilter={lastFilter} />;
  }

  return (
    <ProductGrid
      aria-busy={isPending || undefined}
      className={cn("transition-opacity duration-base", isPending && "opacity-50")}
    >
      {items.map((d, i) => (
        <ProductCard
          key={d.id}
          product={d}
          date={date}
          initialLiked={likedIds?.has(d.id)}
          likeMode={likeMode}
          priority={i < 4}
        />
      ))}
    </ProductGrid>
  );
}

function ProductResultsEmpty({
  onReset,
  lastFilter,
}: Pick<ProductResultsProps, "onReset" | "lastFilter">) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-[1.5px] border-dashed border-input px-6 py-24 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted">
        <CompassIcon aria-hidden className="size-6.5 text-muted-foreground" />
      </div>
      <p className="font-kr text-2xl font-semibold">조건에 맞는 상품이 없어요</p>
      <p className="text-base text-muted-foreground">도시나 테마를 조금 넓혀서 다시 찾아볼까요?</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {lastFilter && (
          <Button
            variant="outline"
            className="h-11 rounded-md px-5 text-base"
            onClick={lastFilter.onClear}
          >
            ‘{lastFilter.label}’ 조건 빼고 보기
          </Button>
        )}
        {onReset && (
          <Button className="h-11 rounded-md px-5 text-base font-semibold" onClick={onReset}>
            필터 초기화
          </Button>
        )}
      </div>
    </div>
  );
}
