import type { Metadata } from "next";

import { DestinationExplorer } from "@/components/destination/destination-explorer";
import { seasonLabel, themeLabel } from "@/lib/constants/taxonomy";
import { getCountries, getDestinations, getThemeCounts } from "@/lib/data/destinations";
import { parseDestinationSearchParams } from "@/lib/validation/destination-filters";

/** 필터가 걸린 목록은 제목에도 반영해 공유했을 때 무엇인지 알 수 있게 한다 */
export async function generateMetadata({
  searchParams,
}: PageProps<"/destinations">): Promise<Metadata> {
  const { filters } = parseDestinationSearchParams(await searchParams);
  const parts = [
    filters.country,
    filters.theme && themeLabel(filters.theme),
    filters.season && `${seasonLabel(filters.season)} 추천`,
  ].filter(Boolean);
  return {
    title: parts.length ? `${parts.join(" · ")} 여행지` : "여행지 둘러보기",
    description: "국가·테마·계절로 여행지를 찾아보세요. 사진과 추천 일정, 여행자 리뷰를 한눈에.",
  };
}

/** 여행지 목록 (명세 4.2) — 조회는 서버에서, 상호작용은 DestinationExplorer(클라이언트)에서 */
export default async function DestinationsPage({ searchParams }: PageProps<"/destinations">) {
  const { filters, page } = parseDestinationSearchParams(await searchParams);

  const [{ items, total }, themeCounts, countries] = await Promise.all([
    getDestinations(filters, page),
    getThemeCounts(filters),
    getCountries(),
  ]);

  return (
    <DestinationExplorer
      filters={filters}
      items={items}
      total={total}
      page={page}
      hasMore={items.length < total}
      countries={countries}
      themeCounts={themeCounts}
    />
  );
}
