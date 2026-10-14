"use client";

import { MapPinIcon, SearchIcon } from "lucide-react";
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

export type SearchItem = { slug: string; name: string; nameEn: string; country: string };

/**
 * 검색 Command 팔레트 (명세 5.5 768: "검색은 아이콘 → Command 팔레트")
 * 여행지 이름(한글·영문)으로 바로 이동하거나, 입력어로 목록 검색 결과를 연다.
 */
export function SearchCommand({
  items,
  open,
  onOpenChange,
}: {
  items: SearchItem[];
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
      title="여행지 검색"
      description="여행지 이름으로 검색하세요"
    >
      {/* shadcn 4의 CommandDialog는 cmdk 루트를 포함하지 않으므로 직접 감싼다 */}
      <Command>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="여행지 이름으로 검색 (예: 교토)"
          // 입력 그룹이 테두리를 그리므로 전역 포커스 그림자는 끄고, iOS 확대 방지를 위해 16px
          className="text-base focus-visible:shadow-none"
        />
        <CommandList>
          <CommandEmpty>일치하는 여행지가 없어요</CommandEmpty>
          {query.trim() && (
            <CommandGroup heading="검색">
              <CommandItem
                value={`search:${query}`}
                onSelect={() => go(`/destinations?q=${encodeURIComponent(query.trim())}`)}
              >
                <SearchIcon aria-hidden />‘{query.trim()}’ 검색 결과 보기
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading="여행지">
            {items.map((item) => (
              <CommandItem
                key={item.slug}
                // cmdk는 value로 필터링하므로 한글·영문·국가를 모두 넣는다
                value={`${item.name} ${item.nameEn} ${item.country}`}
                onSelect={() => go(`/destinations/${item.slug}`)}
              >
                <MapPinIcon aria-hidden />
                {item.name}
                <span className="font-display text-muted-foreground">{item.nameEn}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
