"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

// 서버에서는 지도를 그리지 않고, 브라우저에서 Leaflet을 불러오는 동안 스켈레톤을 보여준다
const LocationMapInner = dynamic(() => import("./location-map-inner"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

type LocationMapProps = { latitude: number; longitude: number; label: string };

export function LocationMap({ latitude, longitude, label }: LocationMapProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* isolate: Leaflet 내부 레이어(z-index 400~)가 고정 내비게이션 위로 올라오지 않게 새 쌓임 맥락을 만든다 */}
      <div className="isolate aspect-square overflow-hidden rounded-lg border bg-muted lg:aspect-4/3">
        <LocationMapInner latitude={latitude} longitude={longitude} label={label} />
      </div>
      <a
        href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=11/${latitude}/${longitude}`}
        target="_blank"
        rel="noreferrer"
        className="self-end text-sm font-medium text-primary hover:underline"
      >
        큰 지도로 보기 ↗
      </a>
    </div>
  );
}
