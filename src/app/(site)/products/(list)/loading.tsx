import { ProductCardSkeleton, ProductGrid } from "@/components/product/product-card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * 목록 첫 로딩: 제목·필터 바 자리 + 카드 스켈레톤 8개 (명세 4.2 상태)
 * 라우트 그룹 (list) 안에 두어 목록만 감싼다 — 상세(/products/[slug])의 레이아웃까지 감싸지 않게.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="상품 불러오는 중">
      <div className="container pt-10 md:pt-14">
        <Skeleton className="h-6 w-24 rounded-sm" />
        <Skeleton className="mt-2 h-10 w-56 rounded-sm" />
      </div>
      <div className="mt-6 border-b">
        <div className="container flex flex-col gap-4 py-4 lg:pt-6 lg:pb-5">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="hidden h-10 w-96 rounded-full lg:block" />
        </div>
      </div>
      <div className="container pt-8 pb-24">
        <ProductGrid>
          {Array.from({ length: 8 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </ProductGrid>
      </div>
    </div>
  );
}
