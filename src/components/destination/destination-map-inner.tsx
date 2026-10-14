"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

// Leaflet 기본 마커는 이미지 경로가 번들러에서 깨지므로, 디자인 토큰으로 그린 HTML 마커를 쓴다
const markerIcon = L.divIcon({
  className: "", // Leaflet 기본 흰 사각형 스타일 제거
  html: '<span class="block size-4 rounded-full border-2 border-white bg-primary shadow-md"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

type DestinationMapInnerProps = { latitude: number; longitude: number; label: string };

/**
 * Leaflet + OpenStreetMap 지도 (브라우저 전용)
 * Leaflet은 import 시점에 window를 쓰기 때문에 destination-map.tsx에서 ssr:false로만 불러온다.
 */
export default function DestinationMapInner({
  latitude,
  longitude,
  label,
}: DestinationMapInnerProps) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={10}
      // 페이지 스크롤 중 지도가 확대·축소되지 않게 한다 (+/- 버튼과 드래그는 가능)
      scrollWheelZoom={false}
      className="size-full"
      aria-label={`${label} 위치 지도`}
    >
      <TileLayer
        // OSM 타일 이용 정책: 출처 표기 필수
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={markerIcon} alt={label} />
    </MapContainer>
  );
}
