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
  // 여행지와 연결된 항목만 좌표가 있어 동선 지도에 표시된다 (사용자 확정)
  destination: {
    id: string;
    slug: string;
    name: string;
    latitude: number;
    longitude: number;
  } | null;
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
       trip_items ( id, day_index, position, title, time, type, note, caution,
                    destinations ( id, slug, name, latitude, longitude ) )`,
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
      destination: i.destinations,
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
