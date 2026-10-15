"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";

export type RoutePoint = { id: string; label: string; latitude: number; longitude: number };

// 번호가 붙은 동그라미 마커 (디자인 토큰 색). 순서를 지도에서 바로 알 수 있게 한다
const numberedIcon = (n: number) =>
  L.divIcon({
    className: "",
    html: `<span class="grid size-7 place-items-center rounded-full border-2 border-white bg-primary text-xs font-semibold text-primary-foreground shadow-md">${n}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

/** 점이 바뀌면 모두 보이도록 지도 범위를 다시 맞춘다 */
function FitBounds({ points }: { points: RoutePoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
    // 점이 하나면 bounds가 한 점이라 너무 확대되므로 maxZoom으로 제한
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [map, points]);
  return null;
}

export default function RouteMapInner({ points }: { points: RoutePoint[] }) {
  const first = points[0];
  return (
    <MapContainer
      center={first ? [first.latitude, first.longitude] : [37.5665, 126.978]}
      zoom={10}
      scrollWheelZoom={false}
      className="size-full"
      aria-label="동선 지도"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.length > 1 && (
        // 선 색은 SVG stroke라 CSS 클래스(디자인 토큰)로 지정한다 — Leaflet 기본 파란색을 덮어쓴다
        <Polyline
          positions={points.map((p) => [p.latitude, p.longitude] as [number, number])}
          pathOptions={{ className: "stroke-primary", weight: 3, dashArray: "6 8" }}
        />
      )}
      {points.map((p, i) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={numberedIcon(i + 1)}
          alt={`${i + 1}. ${p.label}`}
        />
      ))}
      <FitBounds points={points} />
    </MapContainer>
  );
}
