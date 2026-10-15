"use client";

import { ChevronDownIcon, FolderIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";

import { moveLike } from "@/actions/likes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LikeFolder } from "@/lib/data/likes";

const NONE = "none";

/** 찜 카드 하단 "폴더 이동" 메뉴 — 고르는 즉시 표시를 바꾸고(낙관적) 서버에 저장한다 */
export function MoveToFolderMenu({
  productId,
  productTitle,
  folderId,
  folders,
}: {
  productId: string;
  productTitle: string;
  folderId: string | null;
  folders: LikeFolder[];
}) {
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(folderId);
  const currentName = folders.find((f) => f.id === current)?.name ?? "폴더 없음";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${productTitle} 폴더 이동, 현재 ${currentName}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input bg-card px-3 text-sm hover:bg-muted"
      >
        <FolderIcon aria-hidden className="size-3.5 text-muted-foreground" />
        {currentName}
        <ChevronDownIcon aria-hidden className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuLabel className="text-muted-foreground">폴더로 이동</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current ?? NONE}
          onValueChange={(value) => {
            const next = value === NONE ? null : value;
            startTransition(async () => {
              setCurrent(next);
              await moveLike(productId, next);
            });
          }}
        >
          <DropdownMenuRadioItem value={NONE}>폴더 없음</DropdownMenuRadioItem>
          {folders.map((f) => (
            <DropdownMenuRadioItem key={f.id} value={f.id}>
              {f.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
