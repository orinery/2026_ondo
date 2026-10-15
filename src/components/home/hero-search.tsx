"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ko } from "react-day-picker/locale/ko";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { addDays, MAX_DAYS_AHEAD } from "@/lib/booking";
import { CATEGORIES, type CategorySlug } from "@/lib/constants/taxonomy";
import { formatUseDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toSearchParams } from "@/lib/validation/product-filters";

const ALL = "all";

type CityOption = { slug: string; name: string };

/** "YYYY-MM-DD" ↔ 달력의 Date(브라우저 현지 자정) */
const toDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
const toYmd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * 히어로 검색 바 (명세 4.1 "어디로 / 언제 / 테마"를 쇼핑몰용으로: 어디로=도시, 언제=이용일, 종류=카테고리)
 * - 768 이상: 3필드 + 검색 버튼 (알약 모양)
 * - 767 이하: 단일 필드 → 하단 시트에서 3필드 입력
 * 검색하면 /products 목록으로 이동한다. 이용일을 고르면 그날 예약 가능한 상품만 보인다.
 */
export function HeroSearch({ cities, today }: { cities: CityOption[]; today: string }) {
  const router = useRouter();
  const [city, setCity] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [category, setCategory] = useState<CategorySlug | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = toSearchParams({ city, date, category });
    router.push(`/products${query ? `?${query}` : ""}`);
  };

  const fields = (layout: "bar" | "sheet") => (
    <>
      <Field label="어디로" layout={layout}>
        <OptionSelect
          label="어디로"
          value={city}
          allLabel="일본 전체"
          options={cities.map((c) => ({ value: c.slug, label: c.name }))}
          onChange={setCity}
        />
      </Field>
      <Field label="언제" layout={layout}>
        <DateField value={date} today={today} onChange={setDate} />
      </Field>
      <Field label="무엇을" layout={layout}>
        <OptionSelect
          label="무엇을"
          value={category}
          allLabel="전체"
          options={CATEGORIES}
          onChange={(v) => setCategory(v as CategorySlug | null)}
        />
      </Field>
    </>
  );

  return (
    <>
      {/* 768 이상: 알약 모양 검색 바 */}
      <form
        onSubmit={submit}
        role="search"
        className="mt-9 hidden max-w-205 items-center rounded-full bg-card p-2 text-card-foreground shadow-lg md:flex"
      >
        {fields("bar")}
        <Button
          type="submit"
          className="h-14 shrink-0 gap-2 rounded-full px-7 text-base font-semibold"
        >
          <SearchIcon aria-hidden className="size-4.5" />
          검색
        </Button>
      </form>

      {/* 767 이하: 단일 필드 → 바텀시트 */}
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="mt-7 flex h-14 w-full items-center gap-3 rounded-full bg-card px-5 text-left text-base text-muted-foreground shadow-lg md:hidden"
          >
            <SearchIcon aria-hidden className="size-5 text-foreground" />
            어디로, 언제 떠날까요?
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="gap-0 rounded-t-xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="text-lg">상품 찾기</SheetTitle>
            <SheetDescription className="sr-only">
              도시, 이용일, 상품 종류를 골라 보세요.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={submit} role="search" className="flex flex-col gap-3 px-4 pb-4">
            {fields("sheet")}
            <Button type="submit" className="mt-2 h-12 rounded-md text-base font-semibold">
              검색
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({
  label,
  layout,
  children,
}: {
  label: string;
  layout: "bar" | "sheet";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        layout === "bar"
          ? "min-w-0 flex-1 border-r px-6 py-2 last-of-type:border-r-0"
          : "rounded-md border border-stone-500 bg-card px-4 py-2.5",
      )}
    >
      {/* 컨트롤마다 aria-label이 있어 시각용 라벨은 스크린리더에서 숨긴다 */}
      <span aria-hidden className="block text-xs font-semibold">
        {label}
      </span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

/** 이용일 — 오늘부터 180일 안에서 고른다 (상품별 운영 요일은 목록에서 걸러진다) */
function DateField({
  value,
  today,
  onChange,
}: {
  value: string | null;
  today: string;
  onChange: (date: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const last = addDays(today, MAX_DAYS_AHEAD);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={value ? `이용일 ${formatUseDate(value)}, 바꾸기` : "이용일 선택"}
        className={cn(
          "w-full text-left text-base focus-visible:shadow-none",
          !value && "text-muted-foreground",
        )}
      >
        {value ? formatUseDate(value) : "날짜 선택"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={ko}
          selected={value ? toDate(value) : undefined}
          onSelect={(d) => {
            onChange(d ? toYmd(d) : null);
            setOpen(false);
          }}
          startMonth={toDate(today)}
          endMonth={toDate(last)}
          disabled={[{ before: toDate(today) }, { after: toDate(last) }]}
          className="[--cell-size:--spacing(10)]"
        />
      </PopoverContent>
    </Popover>
  );
}

function OptionSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? allLabel;
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger
        aria-label={label}
        // 필드 안에 녹아들도록 테두리·패딩·높이를 없앤다
        className="h-auto! w-full border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0 data-placeholder:text-muted-foreground dark:bg-transparent"
      >
        {/* 라벨을 직접 넘겨 hydration 전(서버 렌더링)에도 선택값이 보이게 한다 */}
        <SelectValue>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
