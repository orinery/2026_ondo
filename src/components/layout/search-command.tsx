"use client";

import { MapPinIcon, SearchIcon, TicketIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type SearchItem = { slug: string; title: string; cityName: string; cityNameEn: string };
export type SearchCity = { slug: string; name: string; nameEn: string };

/**
 * 검색 Command 팔레트 (명세 5.5 768: "검색은 아이콘 → Command 팔레트")
 * 상품명·도시명(한글·영문)으로 바로 이동하거나, 입력어로 목록 검색 결과를 연다.
 */
export function SearchCommand({
  items,
  cities,
  open,
  onOpenChange,
}: {
  items: SearchItem[];
  cities: SearchCity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="상품 검색"
      description="상품이나 도시 이름으로 검색하세요"
    >
      {/* shadcn 4의 CommandDialog는 cmdk 루트를 포함하지 않으므로 직접 감싼다 */}
      <Command>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="상품·도시 검색 (예: 후지산, 교토)"
          // 입력 그룹이 테두리를 그리므로 전역 포커스 그림자는 끄고, iOS 확대 방지를 위해 16px
          className="text-base focus-visible:shadow-none"
        />
        <CommandList>
          <CommandEmpty>일치하는 상품이 없어요</CommandEmpty>
          {query.trim() && (
            <CommandGroup heading="검색">
              <CommandItem
                value={`search:${query}`}
                onSelect={() => go(`/products?q=${encodeURIComponent(query.trim())}`)}
              >
                <SearchIcon aria-hidden />‘{query.trim()}’ 검색 결과 보기
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading="도시">
            {cities.map((city) => (
              <CommandItem
                key={city.slug}
                // cmdk는 value로 필터링하므로 한글·영문을 모두 넣는다
                value={`city:${city.name} ${city.nameEn}`}
                onSelect={() => go(`/products?city=${city.slug}`)}
              >
                <MapPinIcon aria-hidden />
                {city.name}
                <span className="font-display text-muted-foreground">{city.nameEn}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="상품">
            {items.map((item) => (
              <CommandItem
                key={item.slug}
                value={`${item.title} ${item.cityName} ${item.cityNameEn}`}
                onSelect={() => go(`/products/${item.slug}`)}
              >
                <TicketIcon aria-hidden />
                <span className="truncate">{item.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {item.cityName}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
