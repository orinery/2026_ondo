"use client";

import { CalendarIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CATEGORIES, THEMES, type CategorySlug, type ThemeSlug } from "@/lib/constants/taxonomy";
import { debounce, type Debounced } from "@/lib/debounce";
import { formatUseDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  EMPTY_FILTERS,
  SORTS,
  type ProductFilters,
  type SortKey,
} from "@/lib/validation/product-filters";

// 필터 타입과 빈 값은 서버(URL 파싱)와 함께 쓰므로 lib에 둔다
export { EMPTY_FILTERS, type ProductFilters } from "@/lib/validation/product-filters";

export type FilterKey = keyof ProductFilters;
// "reset": 초기화 버튼으로 여러 값을 한꺼번에 바꾼 경우
export type FilterChange = FilterKey | "reset";

export type CityOption = { slug: string; name: string };

type FilterBarProps = {
  value: ProductFilters;
  // changedKey: 빈 결과일 때 "마지막으로 바꾼 필터 해제"를 제안하기 위해 함께 넘긴다
  onChange: (next: ProductFilters, changedKey: FilterChange) => void;
  cities: CityOption[];
  // 테마별 결과 수. 0이면 칩을 disabled로 표시한다 (명세 5.2 칩 disabled "빙하 · 0")
  themeCounts?: Partial<Record<ThemeSlug, number>>;
  resultCount: number | null; // null = 불러오는 중
  className?: string;
  // 디자인 QA 전용: 첫 번째 테마 칩을 hover/focus 상태로 고정
  previewChipState?: "hover" | "focus";
};

const ALL = "all"; // Select/ToggleGroup은 null을 값으로 못 쓰므로 "전체"를 문자열로 표현

/**
 * 상품 필터 바 (명세 5.2 여행지 필터 바를 상품용으로: 국가 → 도시, 계절 → 카테고리, 정렬 추가)
 * - 1024 이상: 검색 · 도시 Select · 카테고리 Segmented / 테마 칩 · 정렬 · 초기화 (2줄)
 * - 1023 이하: 검색 + "필터" 버튼 → 하단 Sheet
 * - 이용일(메인 히어로에서 고른 날짜)이 있으면 지울 수 있는 칩으로 보여준다
 * 이 컴포넌트는 값을 직접 갖지 않는 controlled 컴포넌트다. URL 동기화는 ProductExplorer가 맡는다.
 */
export function FilterBar({
  value,
  onChange,
  cities,
  themeCounts,
  resultCount,
  className,
  previewChipState,
}: FilterBarProps) {
  const update = <K extends FilterKey>(key: K, next: ProductFilters[K]) =>
    onChange({ ...value, [key]: next }, key);

  const activeCount = [value.city, value.theme, value.category].filter(Boolean).length;

  return (
    <div
      className={cn(
        // nav 높이(56/64/72) 바로 아래에 붙는다 (명세 5.2 Sticky)
        "sticky top-14 z-20 border-b bg-background/95 backdrop-blur md:top-16 xl:top-18",
        className,
      )}
    >
      <div className="container flex flex-col gap-4 py-4 lg:pt-6 lg:pb-5">
        <div className="flex items-center gap-3">
          <SearchField value={value.q} onCommit={(q) => update("q", q)} />

          {/* 1024 이상: 도시·카테고리를 한 줄에 */}
          <div className="hidden items-center gap-3 lg:flex">
            <CitySelect value={value.city} cities={cities} onChange={(c) => update("city", c)} />
            <CategorySegment value={value.category} onChange={(c) => update("category", c)} />
          </div>

          {/* 1023 이하: 필터 버튼 → 하단 Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex h-12 shrink-0 items-center gap-2 rounded-full border border-input bg-card px-3.5 text-sm font-medium lg:hidden"
              >
                <SlidersHorizontalIcon aria-hidden className="size-4" />
                필터
                {activeCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                    {activeCount}
                    <span className="sr-only">개 적용됨</span>
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-xl">
              <SheetHeader>
                <SheetTitle className="text-lg">필터</SheetTitle>
                <SheetDescription className="sr-only">
                  도시, 상품 종류, 테마로 상품을 좁히고 정렬을 바꿔요.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4">
                <FilterSection title="도시">
                  <CitySelect
                    value={value.city}
                    cities={cities}
                    onChange={(c) => update("city", c)}
                    className="w-full"
                  />
                </FilterSection>
                <FilterSection title="상품 종류">
                  <CategorySegment
                    value={value.category}
                    onChange={(c) => update("category", c)}
                    className="w-full"
                  />
                </FilterSection>
                <FilterSection title="테마">
                  <ThemeChips
                    value={value.theme}
                    counts={themeCounts}
                    onChange={(t) => update("theme", t)}
                  />
                </FilterSection>
                <FilterSection title="정렬">
                  <SortSelect
                    value={value.sort}
                    onChange={(s) => update("sort", s)}
                    className="w-full"
                  />
                </FilterSection>
              </div>
              {/* 하단 고정: "n개 보기" (명세 5.2 Mobile) */}
              <SheetFooter className="flex-row border-t pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button
                  variant="ghost"
                  className="h-12 px-4 text-sm font-semibold text-primary"
                  onClick={() => onChange({ ...EMPTY_FILTERS, q: value.q }, "reset")}
                >
                  초기화
                </Button>
                <SheetClose asChild>
                  <Button className="h-12 flex-1 rounded-md text-base font-semibold">
                    {resultCount === null ? "불러오는 중…" : `${resultCount}개 보기`}
                  </Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        {value.date && <DateChip date={value.date} onClear={() => update("date", null)} />}

        {/* 1024 이상: 테마 칩 + 정렬 + 초기화 */}
        <div className="hidden items-center justify-between gap-4 lg:flex">
          <ThemeChips
            value={value.theme}
            counts={themeCounts}
            onChange={(t) => update("theme", t)}
            previewChipState={previewChipState}
          />
          <div className="flex shrink-0 items-center gap-2">
            <SortSelect value={value.sort} onChange={(s) => update("sort", s)} />
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS, "reset")}
              className="h-10 shrink-0 px-3.5 text-sm font-semibold text-primary hover:underline"
            >
              필터 초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** 이용일 칩 — 그날 예약 가능한 상품만 보는 중임을 알리고, 한 번에 해제할 수 있게 한다 */
function DateChip({ date, onClear }: { date: string; onClear: () => void }) {
  return (
    <div className="flex">
      <span className="flex h-9 items-center gap-2 rounded-full bg-accent pr-1 pl-3.5 text-sm font-medium text-accent-foreground">
        <CalendarIcon aria-hidden className="size-4" />
        {formatUseDate(date)} 예약 가능
        <button
          type="button"
          onClick={onClear}
          aria-label="이용일 조건 해제"
          className="grid size-7 place-items-center rounded-full hover:bg-background/60"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      </span>
    </div>
  );
}

/**
 * 검색 입력 — 타이핑은 즉시 화면에 반영하고, 부모에는 300ms 디바운스 후 전달한다 (명세 5.2 Behavior).
 */
function SearchField({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const [text, setText] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // 부모 값이 바뀌면(예: 필터 초기화) 입력창도 맞춘다.
  // effect 대신 렌더 중에 비교하는 React 권장 패턴 ("props 변경 시 state 조정")
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value);
  }

  // 최신 onCommit을 ref에 담아 두고, 디바운스 함수는 한 번만 만든다.
  // 왜: 부모가 리렌더되며 onCommit이 새 함수가 될 때마다 디바운스를 다시 만들면
  // 대기 중이던 호출이 취소되어 입력이 유실될 수 있기 때문.
  // (디바운스 함수는 렌더 중이 아니라 effect에서 만든다 — 렌더 중 ref 접근 금지 규칙)
  const onCommitRef = useRef(onCommit);
  const commitRef = useRef<Debounced<[string]> | null>(null);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);
  useEffect(() => {
    const commit = debounce((q: string) => onCommitRef.current(q), 300);
    commitRef.current = commit;
    // 언마운트 시 대기 중인 호출 취소
    return () => commit.cancel();
  }, []);

  return (
    <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-md border border-stone-500 bg-card px-4 transition-[border-color,box-shadow] duration-fast focus-within:border-ring focus-within:shadow-focus">
      <SearchIcon aria-hidden className="size-4.5 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          commitRef.current?.(e.target.value);
        }}
        placeholder="상품·도시 검색"
        aria-label="상품 검색"
        // 입력 16px: iOS 확대 방지 (명세 타입 스케일 base)
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:shadow-none"
      />
    </label>
  );
}

function CitySelect({
  value,
  cities,
  onChange,
  className,
}: {
  value: string | null;
  cities: CityOption[];
  onChange: (city: string | null) => void;
  className?: string;
}) {
  const label = cities.find((c) => c.slug === value)?.name ?? "도시 · 전체";
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger
        aria-label="도시"
        className={cn("h-12! min-w-40 rounded-md bg-card px-3.5 text-base dark:bg-card", className)}
      >
        {/* 라벨을 직접 넘겨 hydration 전(서버 렌더링)에도 선택값이 보이게 한다 */}
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>도시 · 전체</SelectItem>
        {cities.map((c) => (
          <SelectItem key={c.slug} value={c.slug}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SortSelect({
  value,
  onChange,
  className,
}: {
  value: SortKey;
  onChange: (sort: SortKey) => void;
  className?: string;
}) {
  const label = SORTS.find((s) => s.value === value)?.label ?? "추천순";
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortKey)}>
      <SelectTrigger
        aria-label="정렬"
        className={cn("h-10! min-w-34 rounded-md bg-card px-3.5 text-sm dark:bg-card", className)}
      >
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {SORTS.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * 카테고리 Segmented — Radix ToggleGroup(single)은 role="radiogroup"/"radio"와
 * 화살표 키 이동(roving focus)을 기본 제공하므로 명세 a11y(role=radiogroup)를 그대로 만족한다.
 */
function CategorySegment({
  value,
  onChange,
  className,
}: {
  value: CategorySlug | null;
  onChange: (category: CategorySlug | null) => void;
  className?: string;
}) {
  const items = [{ value: ALL, label: "전체" }, ...CATEGORIES];
  return (
    <ToggleGroup
      type="single"
      aria-label="상품 종류"
      spacing={0.5}
      value={value ?? ALL}
      // 이미 선택된 항목을 다시 누르면 Radix는 ""를 준다 → 선택 유지
      onValueChange={(v) => {
        if (!v) return;
        onChange(v === ALL ? null : (v as CategorySlug));
      }}
      className={cn("h-12 rounded-md bg-muted p-1", className)}
    >
      {items.map((c) => (
        <ToggleGroupItem
          key={c.value}
          value={c.value}
          className={cn(
            "h-full flex-1 rounded-sm px-4 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-fast hover:bg-transparent hover:text-foreground",
            "data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-sm",
          )}
        >
          {c.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * 테마 칩 — 단일 선택이지만 명세 a11y가 "칩 aria-pressed"이므로
 * radiogroup이 아닌 일반 토글 버튼(aria-pressed)으로 구현한다.
 */
function ThemeChips({
  value,
  counts,
  onChange,
  previewChipState,
}: {
  value: ThemeSlug | null;
  counts?: Partial<Record<ThemeSlug, number>>;
  onChange: (theme: ThemeSlug | null) => void;
  previewChipState?: "hover" | "focus";
}) {
  const chips: { value: ThemeSlug | null; label: string }[] = [
    { value: null, label: "전체" },
    ...THEMES,
  ];

  return (
    <div role="group" aria-label="테마" className="flex flex-wrap gap-2">
      {chips.map((chip, index) => {
        const selected = value === chip.value;
        const count = chip.value ? (counts?.[chip.value] ?? 0) : undefined;
        // 선택된 칩은 0개여도 해제할 수 있어야 하므로 비활성화하지 않는다
        const disabled = counts !== undefined && count === 0 && !selected;
        return (
          <FilterChip
            key={chip.label}
            selected={selected}
            disabled={disabled}
            onClick={() => onChange(chip.value)}
            data-preview={index === 1 ? previewChipState : undefined}
          >
            {chip.label}
            {disabled && <span aria-hidden> · 0</span>}
          </FilterChip>
        );
      })}
    </div>
  );
}

type FilterChipProps = React.ComponentProps<"button"> & { selected: boolean };

/** 칩 상태: default / hover / active(선택) / focus-visible / disabled (명세 5.2) */
export function FilterChip({ selected, className, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        // 높이 40 + 위아래 2px 여백으로 터치 영역 44 확보 (명세 5.2 Size)
        "my-0.5 h-10 rounded-full border border-input bg-card px-4 text-sm font-medium text-foreground transition-colors duration-fast",
        "hover:border-stone-700 hover:bg-muted preview-hover:border-stone-700 preview-hover:bg-muted",
        "dark:hover:border-stone-300 dark:preview-hover:border-stone-300",
        "preview-focus:shadow-focus",
        "aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background",
        "disabled:pointer-events-none disabled:border-border disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
