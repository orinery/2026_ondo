"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SEASONS, THEMES, type SeasonSlug, type ThemeSlug } from "@/lib/constants/taxonomy";
import { cn } from "@/lib/utils";
import { toSearchParams } from "@/lib/validation/destination-filters";

const ALL = "all";

/**
 * 히어로 검색 바 (명세 4.1)
 * - 768 이상: 어디로 / 언제 / 테마 3필드 + 검색 버튼 (알약 모양)
 * - 767 이하: 단일 필드 → 하단 시트에서 3필드 입력
 * 검색하면 /destinations 목록으로 이동하며 같은 쿼리를 쓴다 (언제 = 계절, 사용자 확정)
 */
export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [season, setSeason] = useState<SeasonSlug | null>(null);
  const [theme, setTheme] = useState<ThemeSlug | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = toSearchParams({ q, country: null, season, theme });
    router.push(`/destinations${query ? `?${query}` : ""}`);
  };

  const fields = (layout: "bar" | "sheet") => (
    <>
      <Field label="어디로" layout={layout} htmlFor={`hero-q-${layout}`}>
        <input
          id={`hero-q-${layout}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="도시, 나라, 여행지 검색"
          className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:shadow-none"
        />
      </Field>
      <Field label="언제" layout={layout}>
        <OptionSelect
          label="언제"
          value={season}
          placeholder="계절 선택"
          options={SEASONS}
          onChange={(v) => setSeason(v as SeasonSlug | null)}
        />
      </Field>
      <Field label="테마" layout={layout}>
        <OptionSelect
          label="테마"
          value={theme}
          placeholder="전체"
          options={THEMES}
          onChange={(v) => setTheme(v as ThemeSlug | null)}
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
            어디로 떠날까요?
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="gap-0 rounded-t-xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="text-lg">여행지 찾기</SheetTitle>
            <SheetDescription className="sr-only">
              어디로, 언제, 어떤 테마로 떠날지 골라 보세요.
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
  htmlFor,
  children,
}: {
  label: string;
  layout: "bar" | "sheet";
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        layout === "bar"
          ? "min-w-0 flex-1 border-r px-6 py-2 first:flex-[1.3] last-of-type:border-r-0"
          : "rounded-md border border-input bg-card px-4 py-2.5",
      )}
    >
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block text-xs font-semibold">
          {label}
        </label>
      ) : (
        <span aria-hidden className="block text-xs font-semibold">
          {label}
        </span>
      )}
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function OptionSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  const allLabel = placeholder === "전체" ? "전체" : "언제든";
  const selectedLabel = options.find((o) => o.value === value)?.label ?? allLabel;
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger
        aria-label={label}
        // 필드 안에 녹아들도록 테두리·패딩·높이를 없앤다
        className="h-auto! w-full border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0 data-placeholder:text-muted-foreground dark:bg-transparent"
      >
        {/* 라벨을 직접 넘겨 hydration 전(서버 렌더링)에도 선택값이 보이게 한다 */}
        <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
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
