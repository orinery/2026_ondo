"use client";

import { useMemo, useState } from "react";

import {
  EMPTY_FILTERS,
  FilterBar,
  type FilterChange,
  type ProductFilters,
} from "@/components/product/filter-bar";
import { ProductResults } from "@/components/product/product-results";
import { categoryLabel, THEMES, themeLabel, type ThemeSlug } from "@/lib/constants/taxonomy";
import { MOCK_PRODUCTS } from "@/lib/mock/products";
import type { ProductSummary } from "@/types/product";

type ForcedState = "none" | "loading" | "pending" | "empty";

/** 필터 바 + 결과 영역을 목업 데이터로 실제처럼 동작시키는 데모 (실제 목록은 URL·DB 사용) */
export function FilterDemo() {
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const [lastChanged, setLastChanged] = useState<FilterChange | null>(null);
  const [forced, setForced] = useState<ForcedState>("none");

  const filtered = useMemo(() => applyFilters(MOCK_PRODUCTS, filters), [filters]);

  // 테마별 결과 수: 다른 조건은 그대로 두고 테마만 바꿨을 때의 개수 → 0이면 칩 disabled
  const themeCounts = useMemo(() => {
    const counts: Partial<Record<ThemeSlug, number>> = {};
    for (const t of THEMES)
      counts[t.value] = applyFilters(MOCK_PRODUCTS, { ...filters, theme: t.value }).length;
    return counts;
  }, [filters]);

  const items = forced === "empty" ? [] : filtered;
  const cities = [...new Map(MOCK_PRODUCTS.map((p) => [p.city.slug, p.city])).values()];

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-wrap items-center gap-2 text-sm">
        <legend className="sr-only">결과 영역 상태 강제</legend>
        {(["none", "loading", "pending", "empty"] as const).map((s) => (
          <label key={s} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5">
            <input
              type="radio"
              name="forced"
              checked={forced === s}
              onChange={() => setForced(s)}
            />
            {s === "none" ? "실제 동작" : s}
          </label>
        ))}
      </fieldset>

      <div className="overflow-hidden rounded-lg border">
        <FilterBar
          value={filters}
          onChange={(next, key) => {
            setFilters(next);
            setLastChanged(key);
          }}
          cities={cities}
          themeCounts={themeCounts}
          resultCount={forced === "loading" ? null : items.length}
          className="static"
        />
        <div className="p-5 md:p-8">
          <p aria-live="polite" className="mb-6 text-base text-muted-foreground">
            {forced === "loading" ? "불러오는 중…" : `${items.length}개`}
          </p>
          <ProductResults
            items={items}
            likedIds={new Set(["1", "5"])}
            likeMode="local"
            isLoading={forced === "loading"}
            isPending={forced === "pending"}
            onReset={() => setFilters(EMPTY_FILTERS)}
            lastFilter={lastFilterSuggestion(filters, lastChanged, (next) => setFilters(next))}
          />
        </div>
      </div>
    </div>
  );
}

const SORTERS: Record<ProductFilters["sort"], (a: ProductSummary, b: ProductSummary) => number> = {
  recommend: (a, b) => Number(a.id) - Number(b.id),
  price_asc: (a, b) => a.adultPrice - b.adultPrice,
  price_desc: (a, b) => b.adultPrice - a.adultPrice,
  rating: (a, b) => b.rating - a.rating,
  reviews: (a, b) => b.reviewCount - a.reviewCount,
};

function applyFilters(list: ProductSummary[], f: ProductFilters) {
  const q = f.q.trim().toLowerCase();
  return list
    .filter(
      (p) =>
        (!f.city || p.city.slug === f.city) &&
        (!f.category || p.category === f.category) &&
        (!f.theme || p.theme === f.theme) &&
        (!q ||
          p.title.includes(q) ||
          p.city.name.includes(q) ||
          p.city.nameEn.toLowerCase().includes(q)),
    )
    .sort(SORTERS[f.sort]);
}

/** 빈 결과일 때 "마지막으로 바꾼 필터 해제" 제안 문구와 동작을 만든다 (명세 5.2 empty) */
function lastFilterSuggestion(
  f: ProductFilters,
  key: FilterChange | null,
  apply: (next: ProductFilters) => void,
) {
  if (key === "theme" && f.theme)
    return { label: themeLabel(f.theme), onClear: () => apply({ ...f, theme: null }) };
  if (key === "category" && f.category)
    return { label: categoryLabel(f.category), onClear: () => apply({ ...f, category: null }) };
  if (key === "city" && f.city)
    return { label: f.city, onClear: () => apply({ ...f, city: null }) };
  if (key === "q" && f.q) return { label: f.q, onClear: () => apply({ ...f, q: "" }) };
  return null;
}
