import { CompassIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DestinationSummary } from "@/types/destination";

import { DestinationCard, DestinationCardSkeleton, DestinationGrid } from "./destination-card";

type DestinationResultsProps = {
  items: DestinationSummary[];
  likedIds?: ReadonlySet<string>;
  likeMode?: "server" | "local";
  // 첫 로딩(이전 결과 없음) → 스켈레톤 8개
  isLoading?: boolean;
  // 필터 변경 중(이전 결과 있음) → 이전 결과를 opacity .5로 유지 (명세 5.2 결과 영역 loading)
  isPending?: boolean;
  onReset?: () => void;
  // 빈 결과일 때 "마지막으로 바꾼 필터 해제" 제안 (명세 5.2 empty)
  lastFilter?: { label: string; onClear: () => void } | null;
};

const SKELETON_COUNT = 8;

/** 여행지 결과 그리드 + 로딩·빈 상태 (명세 4.2 결과 그리드 · 상태) */
export function DestinationResults({
  items,
  likedIds,
  likeMode = "server",
  isLoading = false,
  isPending = false,
  onReset,
  lastFilter,
}: DestinationResultsProps) {
  if (isLoading) {
    return (
      <DestinationGrid aria-busy="true" aria-label="여행지 불러오는 중">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <DestinationCardSkeleton key={i} />
        ))}
      </DestinationGrid>
    );
  }

  if (items.length === 0) {
    return <DestinationResultsEmpty onReset={onReset} lastFilter={lastFilter} />;
  }

  return (
    <DestinationGrid
      aria-busy={isPending || undefined}
      className={cn("transition-opacity duration-base", isPending && "opacity-50")}
    >
      {items.map((d, i) => (
        <DestinationCard
          key={d.id}
          destination={d}
          initialLiked={likedIds?.has(d.id)}
          likeMode={likeMode}
          priority={i < 4}
        />
      ))}
    </DestinationGrid>
  );
}

function DestinationResultsEmpty({
  onReset,
  lastFilter,
}: Pick<DestinationResultsProps, "onReset" | "lastFilter">) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-[1.5px] border-dashed border-input px-6 py-24 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted">
        <CompassIcon aria-hidden className="size-6.5 text-muted-foreground" />
      </div>
      <p className="font-kr text-2xl font-semibold">조건에 맞는 여행지가 없어요</p>
      <p className="text-base text-muted-foreground">
        계절이나 테마를 조금 넓혀서 다시 찾아볼까요?
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {lastFilter && (
          <Button
            variant="outline"
            className="h-11 rounded-md px-5 text-base"
            onClick={lastFilter.onClear}
          >
            ‘{lastFilter.label}’ 조건 빼고 보기
          </Button>
        )}
        {onReset && (
          <Button className="h-11 rounded-md px-5 text-base font-semibold" onClick={onReset}>
            필터 초기화
          </Button>
        )}
      </div>
    </div>
  );
}
