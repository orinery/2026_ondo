"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_PHOTO, reviewSchema } from "@/lib/validation/review";

import type { ActionResult } from "@/lib/action-result";

type SaveReviewInput = {
  destinationId: string;
  slug: string;
  rating: number;
  content: string;
  // 사진 처리: string = 새로 올린 사진 경로 / null = 사진 삭제 / undefined = 기존 사진 유지
  photoPath?: string | null;
};

const metaSchema = z.object({
  destinationId: z.uuid(),
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
});

// 리뷰가 바뀌면 상세(목록·평점)와 평점이 보이는 목록·메인을 다시 그린다
function refresh(slug: string) {
  revalidatePath(`/destinations/${slug}`);
  revalidatePath("/destinations");
  revalidatePath("/");
}

/**
 * 리뷰 저장 (작성·수정 겸용). 여행지당 1개(사용자 확정)라서 기존 리뷰가 있으면 수정한다.
 * upsert를 쓰지 않는 이유: 충돌 시 UPDATE 대상에 destination_id가 포함되는데,
 * 컬럼 권한상 destination_id는 수정할 수 없게 막아 두었기 때문.
 */
export async function saveReview(input: SaveReviewInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const meta = metaSchema.safeParse(input);
  const parsed = reviewSchema.safeParse(input);
  if (!meta.success || !parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error?.issues[0]?.message };
  }
  // 사진 경로는 반드시 본인 폴더여야 한다 (Storage 정책과 같은 규칙을 서버에서도 확인)
  if (input.photoPath && !input.photoPath.startsWith(`${user.id}/`)) {
    return { ok: false, reason: "invalid", message: "사진 경로가 올바르지 않아요" };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("reviews")
    .select("id, photo_path")
    .eq("destination_id", meta.data.destinationId)
    .eq("user_id", user.id)
    .maybeSingle();

  const photoChanged = input.photoPath !== undefined;
  const values = {
    rating: parsed.data.rating,
    content: parsed.data.content,
    ...(photoChanged ? { photo_path: input.photoPath } : {}),
  };

  const { error } = existing
    ? await supabase.from("reviews").update(values).eq("id", existing.id)
    : await supabase.from("reviews").insert({ ...values, destination_id: meta.data.destinationId });
  if (error) return { ok: false, reason: "error" };

  // 사진을 바꾸거나 지웠다면 이전 파일을 지운다 (Storage에 고아 파일이 남지 않게)
  if (photoChanged && existing?.photo_path && existing.photo_path !== input.photoPath) {
    await supabase.storage.from(REVIEW_PHOTO.bucket).remove([existing.photo_path]);
  }

  refresh(meta.data.slug);
  return { ok: true };
}

export async function deleteReview(reviewId: string, slug: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  if (!z.uuid().safeParse(reviewId).success) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  // RLS가 본인 리뷰만 지우게 하므로, 남의 리뷰 id를 보내면 0행이 지워지고 끝난다
  const { data, error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .select("photo_path")
    .maybeSingle();
  if (error) return { ok: false, reason: "error" };
  if (data?.photo_path) await supabase.storage.from(REVIEW_PHOTO.bucket).remove([data.photo_path]);

  refresh(slug);
  return { ok: true };
}
