"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { seasonLabel, themeLabel, type ThemeSlug } from "@/lib/constants/taxonomy";
import {
  EMPTY_FILTERS,
  toSearchParams,
  type DestinationFilters,
} from "@/lib/validation/destination-filters";
import type { DestinationSummary } from "@/types/destination";

import { DestinationResults } from "./destination-results";
import { FilterBar, type FilterChange } from "./filter-bar";

type DestinationExplorerProps = {
  filters: DestinationFilters; // 서버가 URL에서 파싱한 현재 필터
  items: DestinationSummary[];
  total: number;
  page: number;
  hasMore: boolean;
  countries: string[];
  themeCounts: Partial<Record<ThemeSlug, number>>;
  likedIds: string[]; // 서버→클라이언트로는 Set을 넘길 수 없어 배열로 받는다
};

/**
 * 여행지 목록의 상호작용 영역 (명세 4.2)
 *
 * 데이터 흐름: 필터 변경 → URL 쿼리 변경(router.replace) → 서버 페이지가 다시 조회 → 새 props
 * - 상태의 원본은 URL이다. 새로고침·공유·뒤로가기해도 같은 결과가 나온다(명세: URL 쿼리 동기화).
 * - useTransition: 서버 응답을 기다리는 동안 이전 결과를 opacity .5로 유지한다(명세 5.2 loading).
 */
export function DestinationExplorer({
  filters,
  items,
  total,
  page,
  hasMore,
  countries,
  themeCounts,
  likedIds,
}: DestinationExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  // 빈 결과일 때 "마지막으로 바꾼 필터 해제"를 제안하기 위해 기억한다
  const [lastChanged, setLastChanged] = useState<FilterChange | null>(null);

  const navigate = (next: DestinationFilters) => {
    const query = toSearchParams(next); // 필터가 바뀌면 1페이지부터
    startTransition(() => {
      // replace: 필터를 바꿀 때마다 방문 기록이 쌓이지 않게 / scroll:false: 스크롤 위치 유지
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const lastFilter = suggestionFor(filters, lastChanged, navigate);

  return (
    <>
      <div className="container pt-10 md:pt-14">
        <p className="font-display text-xl text-muted-foreground italic md:text-2xl">Explore</p>
        <div className="mt-1 flex items-baseline gap-3.5">
          <h1 className="font-kr text-3xl font-semibold md:text-4xl">여행지 둘러보기</h1>
          {/* 결과 수는 바뀔 때마다 스크린리더가 읽어 준다 (명세 5.2 a11y) */}
          <p aria-live="polite" className="text-base text-muted-foreground">
            {isPending ? "불러오는 중…" : `${total}곳`}
          </p>
        </div>
      </div>

      <FilterBar
        className="mt-6"
        value={filters}
        onChange={(next, key) => {
          setLastChanged(key);
          navigate(next);
        }}
        countries={countries}
        themeCounts={themeCounts}
        resultCount={isPending ? null : total}
      />

      <div className="container pt-8 pb-section-sm md:pb-24">
        <DestinationResults
          items={items}
          likedIds={new Set(likedIds)}
          isPending={isPending}
          onReset={() => navigate(EMPTY_FILTERS)}
          lastFilter={lastFilter}
        />

        {hasMore && !isPending && (
          <div className="mt-12 flex justify-center">
            <Link
              href={`${pathname}?${toSearchParams(filters, page + 1)}`}
              scroll={false}
              replace
              className="flex h-12 items-center rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted"
            >
              더 보기{" "}
              <span className="ml-1 text-muted-foreground">
                ({items.length}/{total})
              </span>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

function suggestionFor(
  f: DestinationFilters,
  key: FilterChange | null,
  apply: (next: DestinationFilters) => void,
) {
  if (key === "theme" && f.theme)
    return { label: themeLabel(f.theme), onClear: () => apply({ ...f, theme: null }) };
  if (key === "season" && f.season)
    return { label: seasonLabel(f.season), onClear: () => apply({ ...f, season: null }) };
  if (key === "country" && f.country)
    return { label: f.country, onClear: () => apply({ ...f, country: null }) };
  if (key === "q" && f.q) return { label: f.q, onClear: () => apply({ ...f, q: "" }) };
  return null;
}
