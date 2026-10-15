import type { Metadata } from "next";

import { ProductExplorer } from "@/components/product/product-explorer";
import { categoryLabel, themeLabel } from "@/lib/constants/taxonomy";
import { getLikedIds } from "@/lib/data/likes";
import { getCities, getProducts, getThemeCounts } from "@/lib/data/products";
import { formatUseDate } from "@/lib/format";
import { parseProductSearchParams, type ProductFilters } from "@/lib/validation/product-filters";

/** 필터에 맞춘 제목: "도쿄 투어·액티비티", "문화·미식 상품" … */
function headingOf(filters: ProductFilters, cityName: string | undefined) {
  const subject = filters.category ? categoryLabel(filters.category) : "상품";
  const parts = [cityName, filters.theme && themeLabel(filters.theme), subject].filter(Boolean);
  // 아무 조건도 없으면(= "상품"만 남으면) 기본 제목
  return parts.length === 1 && !filters.category ? "일본 여행 상품" : parts.join(" ");
}

/** 필터가 걸린 목록은 제목에도 반영해 공유했을 때 무엇인지 알 수 있게 한다 */
export async function generateMetadata({
  searchParams,
}: PageProps<"/products">): Promise<Metadata> {
  const { filters } = parseProductSearchParams(await searchParams);
  const cities = await getCities();
  const city = cities.find((c) => c.slug === filters.city)?.name;
  const heading = headingOf(filters, city);
  return {
    title: filters.date ? `${formatUseDate(filters.date)} ${heading}` : heading,
    description:
      "도쿄·교토·오사카·후쿠오카·삿포로·오키나와의 투어·액티비티와 입장권을 날짜와 인원만 골라 바로 예약하세요.",
  };
}

/** 상품 목록 (명세 4.2 패턴) — 조회는 서버에서, 상호작용은 ProductExplorer(클라이언트)에서 */
export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { filters, page } = parseProductSearchParams(await searchParams);

  const [{ items, total }, themeCounts, cities, likedIds] = await Promise.all([
    getProducts(filters, page),
    getThemeCounts(filters),
    getCities(),
    getLikedIds(),
  ]);

  return (
    <ProductExplorer
      filters={filters}
      items={items}
      total={total}
      page={page}
      hasMore={items.length < total}
      cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
      themeCounts={themeCounts}
      likedIds={likedIds}
      heading={headingOf(filters, cities.find((c) => c.slug === filters.city)?.name)}
    />
  );
}
