import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ProductSummary } from "@/types/product";

/**
 * 현재 사용자가 찜한 상품 id 목록 — 카드의 하트 초기 상태에 쓴다.
 * 비로그인이면 빈 배열(쿼리 없음). RLS 덕분에 조건 없이 조회해도 본인 찜만 나온다.
 */
export const getLikedIds = cache(async (): Promise<string[]> => {
  if (!(await getCurrentUser())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("likes").select("product_id");
  if (error) throw error;
  return (data ?? []).map((l) => l.product_id);
});

export type LikeFolder = { id: string; name: string; count: number };
export type LikedProduct = ProductSummary & { folderId: string | null };

/** 나의 여행 > 찜 목록: 찜한 상품(최근 순) + 폴더별 개수 */
export async function getMyLikes(): Promise<{ likes: LikedProduct[]; folders: LikeFolder[] }> {
  const supabase = await createClient();
  const [likesResult, foldersResult] = await Promise.all([
    supabase
      .from("likes")
      .select(
        `folder_id, created_at,
         products ( id, slug, title, category, theme, image_url, image_alt, adult_price, list_adult_price,
                    rating_avg, review_count, unavailable_reason, cities ( slug, name, name_en ) )`,
      )
      .order("created_at", { ascending: false }),
    supabase.from("like_folders").select("id, name").order("created_at"),
  ]);
  if (likesResult.error) throw likesResult.error;
  if (foldersResult.error) throw foldersResult.error;

  const likes: LikedProduct[] = (likesResult.data ?? []).flatMap(({ folder_id, products: p }) =>
    p
      ? [
          {
            id: p.id,
            slug: p.slug,
            title: p.title,
            city: { slug: p.cities.slug, name: p.cities.name, nameEn: p.cities.name_en },
            category: p.category,
            theme: p.theme,
            imageUrl: p.image_url,
            imageAlt: p.image_alt,
            adultPrice: p.adult_price,
            listAdultPrice: p.list_adult_price,
            rating: Number(p.rating_avg),
            reviewCount: p.review_count,
            unavailableReason: p.unavailable_reason,
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
