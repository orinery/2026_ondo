"use client";

import { useMemo, useState } from "react";

import { DestinationResults } from "@/components/destination/destination-results";
import {
  EMPTY_FILTERS,
  FilterBar,
  type DestinationFilters,
  type FilterChange,
} from "@/components/destination/filter-bar";
import { seasonLabel, THEMES, themeLabel, type ThemeSlug } from "@/lib/constants/taxonomy";
import { MOCK_DESTINATIONS } from "@/lib/mock/destinations";
import type { DestinationSummary } from "@/types/destination";

type ForcedState = "none" | "loading" | "pending" | "empty";

/** 필터 바 + 결과 영역을 목업 데이터로 실제처럼 동작시키는 데모 (5단계에서 URL·DB로 교체) */
export function FilterDemo() {
  const [filters, setFilters] = useState<DestinationFilters>(EMPTY_FILTERS);
  const [lastChanged, setLastChanged] = useState<FilterChange | null>(null);
  const [forced, setForced] = useState<ForcedState>("none");

  const filtered = useMemo(() => applyFilters(MOCK_DESTINATIONS, filters), [filters]);

  // 테마별 결과 수: 다른 조건은 그대로 두고 테마만 바꿨을 때의 개수 → 0이면 칩 disabled
  const themeCounts = useMemo(() => {
    const counts: Partial<Record<ThemeSlug, number>> = {};
    for (const t of THEMES)
      counts[t.value] = applyFilters(MOCK_DESTINATIONS, { ...filters, theme: t.value }).length;
    return counts;
  }, [filters]);

  const items = forced === "empty" ? [] : filtered;
  const countries = [...new Set(MOCK_DESTINATIONS.map((d) => d.country))];

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
          countries={countries}
          themeCounts={themeCounts}
          resultCount={forced === "loading" ? null : items.length}
          className="static"
        />
        <div className="p-5 md:p-8">
          <p aria-live="polite" className="mb-6 text-base text-muted-foreground">
            {forced === "loading" ? "불러오는 중…" : `${items.length}곳`}
          </p>
          <DestinationResults
            items={items}
            likedIds={new Set(["1", "7"])}
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

function applyFilters(list: DestinationSummary[], f: DestinationFilters) {
  const q = f.q.trim().toLowerCase();
  return list.filter(
    (d) =>
      (!f.country || d.country === f.country) &&
      (!f.theme || d.theme === f.theme) &&
      (!f.season || d.season === f.season) &&
      (!q || d.name.includes(q) || d.nameEn.toLowerCase().includes(q)),
  );
}

/** 빈 결과일 때 "마지막으로 바꾼 필터 해제" 제안 문구와 동작을 만든다 (명세 5.2 empty) */
function lastFilterSuggestion(
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
