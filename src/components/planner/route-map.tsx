"use client";

import { MapIcon } from "lucide-react";
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { RoutePoint } from "./route-map-inner";

const RouteMapInner = dynamic(() => import("./route-map-inner"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

export type { RoutePoint };

/**
 * 동선 지도 (명세 4.4: 플래너 동선 지도)
 * 선택한 Day에서 상품과 연결된 항목만 순서대로 번호를 붙여 선으로 잇는다 (사용자 확정: 자유 장소는 좌표 없음)
 */
export function RouteMap({ points, className }: { points: RoutePoint[]; className?: string }) {
  return (
    <div className={cn("isolate overflow-hidden rounded-lg border bg-muted", className)}>
      {points.length === 0 ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
          <MapIcon aria-hidden className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            상품과 연결된 일정이 있으면
            <br />
            동선이 지도에 표시돼요
          </p>
        </div>
      ) : (
        <RouteMapInner points={points} />
      )}
    </div>
  );
}
