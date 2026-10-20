import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ItineraryItemType } from "@/types/itinerary";

/**
 * 여행·일정 조회 (Data Access Layer)
 * 조건 없이 조회해도 RLS 덕분에 본인 여행만 나온다. 남의 여행 id로 조회하면 null.
 */

export type TripSummary = {
  id: string;
  title: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  itemCount: number;
};

export type TripItem = {
  id: string;
  dayIndex: number;
  position: number;
  title: string;
  time: string | null; // "HH:MM"
  type: ItineraryItemType;
  note: string | null;
  caution: string | null;
  // 상품과 연결된 항목만 좌표(만나는 장소)가 있어 동선 지도에 표시된다
  product: {
    id: string;
    slug: string;
    title: string;
    latitude: number;
    longitude: number;
  } | null;
  // 주문으로 자동 추가된 예약 항목 — 날짜 이동·삭제는 DB가 막는다 (예약 취소로만 지워짐)
  isBooking: boolean;
  orderNo: string | null; // 예약 항목이면 주문번호 (예약 상세 링크)
};

export type TripDetail = TripSummary & { items: TripItem[] };

/** 내 여행 목록 — 가까운 출발일 순 */
export const getMyTrips = cache(async (): Promise<TripSummary[]> => {
  if (!(await getCurrentUser())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select("id, title, start_date, end_date, trip_items ( count )")
    .order("start_date")
    .order("created_at");
  if (error) throw error;

  return (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    startDate: t.start_date,
    endDate: t.end_date,
    // 중첩 count 집계는 [{ count: n }] 형태로 온다
    itemCount: t.trip_items[0]?.count ?? 0,
  }));
});

export async function getTrip(tripId: string): Promise<TripDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select(
      `id, title, start_date, end_date,
       trip_items ( id, day_index, position, title, time, type, note, caution, order_item_id,
                    products ( id, slug, title, latitude, longitude ),
                    order_items ( orders ( order_no ) ) )`,
    )
    .eq("id", tripId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const items: TripItem[] = data.trip_items
    .map((i) => ({
      id: i.id,
      dayIndex: i.day_index,
      position: i.position,
      title: i.title,
      time: i.time ? i.time.slice(0, 5) : null,
      type: i.type,
      note: i.note,
      caution: i.caution,
      product: i.products,
      isBooking: i.order_item_id !== null,
      orderNo: i.order_items?.orders.order_no ?? null,
    }))
    .sort((a, b) => a.dayIndex - b.dayIndex || a.position - b.position);

  return {
    id: data.id,
    title: data.title,
    startDate: data.start_date,
    endDate: data.end_date,
    itemCount: items.length,
    items,
  };
}
