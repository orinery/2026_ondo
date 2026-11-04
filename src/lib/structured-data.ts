import type { ProductDetail, Seller } from "@/lib/data/products";
import { publicEnv } from "@/lib/env";

/**
 * 상품 상세 구조화 데이터 (Quick Win Q5) — schema.org Product + BreadcrumbList.
 * 검색 결과에 가격·평점이 함께 보일 수 있게(리치 결과) 화면에 보이는 값과 같은 값만 넣는다.
 * - 가격: 성인 1인 기본가 (날짜별 가격·옵션은 표현하지 않는다)
 * - 평점: 리뷰가 있을 때만 (리뷰 0개에 평점을 넣으면 구글 가이드라인 위반)
 * - 판매 중지·공개 전이면 재고 없음
 */
export function productJsonLd(product: ProductDetail, seller: Seller | null) {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const url = `${base}/products/${product.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: product.title,
        description: product.summary,
        image: product.images.map((i) => i.src),
        sku: product.slug,
        category: product.category === "tour" ? "투어·액티비티" : "티켓·패스",
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: "KRW",
          price: product.adultPrice,
          availability: product.unavailableReason
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
          ...(seller && { seller: { "@type": "Organization", name: seller.name } }),
        },
        ...(product.reviewCount > 0 && {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: base },
          {
            "@type": "ListItem",
            position: 2,
            name: `${product.city.name} 상품`,
            item: `${base}/products?city=${product.city.slug}`,
          },
          { "@type": "ListItem", position: 3, name: product.title, item: url },
        ],
      },
    ],
  };
}

/**
 * JSON-LD를 <script>에 넣을 문자열로. JSON.stringify는 "</script>" 같은 문자열을 막지 않으므로
 * "<"를 유니코드 이스케이프로 바꾼다 (상품명·소개는 파트너가 입력한 값이라 필요하다 — Next.js JSON-LD 가이드)
 */
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
