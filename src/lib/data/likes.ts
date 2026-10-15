import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DestinationSummary } from "@/types/destination";

/**
 * 현재 사용자가 찜한 여행지 id 목록 — 카드의 하트 초기 상태에 쓴다.
 * 비로그인이면 빈 배열(쿼리 없음). RLS 덕분에 조건 없이 조회해도 본인 찜만 나온다.
 */
export const getLikedIds = cache(async (): Promise<string[]> => {
  if (!(await getCurrentUser())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("likes").select("destination_id");
  if (error) throw error;
  return (data ?? []).map((l) => l.destination_id);
});

export type LikeFolder = { id: string; name: string; count: number };
export type LikedDestination = DestinationSummary & { folderId: string | null };

/** 나의 여행 > 찜 목록: 찜한 여행지(최근 순) + 폴더별 개수 */
export async function getMyLikes(): Promise<{ likes: LikedDestination[]; folders: LikeFolder[] }> {
  const supabase = await createClient();
  const [likesResult, foldersResult] = await Promise.all([
    supabase
      .from("likes")
      .select(
        `folder_id, created_at,
         destinations ( id, slug, name, name_en, country, theme, season, image_url, image_alt,
                         rating_avg, review_count, unavailable_reason )`,
      )
      .order("created_at", { ascending: false }),
    supabase.from("like_folders").select("id, name").order("created_at"),
  ]);
  if (likesResult.error) throw likesResult.error;
  if (foldersResult.error) throw foldersResult.error;

  const likes: LikedDestination[] = (likesResult.data ?? []).flatMap(
    ({ folder_id, destinations: d }) =>
      d
        ? [
            {
              id: d.id,
              slug: d.slug,
              name: d.name,
              nameEn: d.name_en,
              country: d.country,
              theme: d.theme,
              season: d.season,
              imageUrl: d.image_url,
              imageAlt: d.image_alt,
              rating: Number(d.rating_avg),
              reviewCount: d.review_count,
              unavailableReason: d.unavailable_reason,
              folderId: folder_id,
            },
          ]
        : [],
  );

  const folders = (foldersResult.data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    count: likes.filter((l) => l.folderId === f.id).length,
  }));

  return { likes, folders };
}
