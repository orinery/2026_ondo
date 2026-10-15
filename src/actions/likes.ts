"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * 찜·찜 폴더 Server Actions
 * - 로그인 확인 → 입력 검증(Zod) → supabase-js 쿼리(RLS가 본인 행만 허용) 순서로 처리한다.
 * - user_id는 보내지 않는다. DB 기본값 auth.uid()가 채우고, 컬럼 권한상 입력할 수도 없다.
 */

// 결과 타입은 여러 Action이 공유하므로 lib에 둔다 (기존 import 경로 호환을 위해 다시 내보낸다)
export type { ActionResult } from "@/lib/action-result";

const uuid = z.uuid();
const folderName = z
  .string()
  .trim()
  .min(1, "폴더 이름을 입력해 주세요")
  .max(20, "폴더 이름은 20자 이하로 입력해 주세요");

// 찜 상태가 바뀌면 카드의 하트(목록·메인·상세)와 나의 여행이 모두 바뀌어야 하므로 레이아웃 단위로 다시 그린다
const refresh = () => revalidatePath("/", "layout");

export async function toggleLike(productId: string, liked: boolean): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!uuid.safeParse(productId).success) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  if (liked) {
    const { error } = await supabase.from("likes").insert({ product_id: productId });
    // 23505(unique 위반) = 이미 찜한 상태 → 목표 상태와 같으므로 성공으로 본다 (중복 클릭·다른 탭)
    if (error && error.code !== "23505") return { ok: false, reason: "error" };
  } else {
    const { error } = await supabase.from("likes").delete().eq("product_id", productId);
    if (error) return { ok: false, reason: "error" };
  }

  refresh();
  return { ok: true };
}

export async function createFolder(name: string): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = folderName.safeParse(name);
  if (!parsed.success)
    return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.from("like_folders").insert({ name: parsed.data });
  if (error) {
    return error.code === "23505"
      ? { ok: false, reason: "invalid", message: "같은 이름의 폴더가 있어요" }
      : { ok: false, reason: "error" };
  }
  refresh();
  return { ok: true };
}

export async function renameFolder(folderId: string, name: string): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  const parsed = folderName.safeParse(name);
  if (!uuid.safeParse(folderId).success || !parsed.success) {
    return { ok: false, reason: "invalid", message: parsed.error?.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("like_folders")
    .update({ name: parsed.data })
    .eq("id", folderId);
  if (error) {
    return error.code === "23505"
      ? { ok: false, reason: "invalid", message: "같은 이름의 폴더가 있어요" }
      : { ok: false, reason: "error" };
  }
  refresh();
  return { ok: true };
}

/** 폴더를 지워도 찜은 남는다 (FK on delete set null → "폴더 없음") */
export async function deleteFolder(folderId: string): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!uuid.safeParse(folderId).success) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.from("like_folders").delete().eq("id", folderId);
  if (error) return { ok: false, reason: "error" };
  refresh();
  return { ok: true };
}

/** 찜을 다른 폴더로 옮긴다. folderId = null 이면 폴더에서 뺀다. 남의 폴더는 RLS가 막는다 */
export async function moveLike(productId: string, folderId: string | null): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, reason: "unauthenticated" };
  if (!uuid.safeParse(productId).success || (folderId && !uuid.safeParse(folderId).success)) {
    return { ok: false, reason: "invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("likes")
    .update({ folder_id: folderId })
    .eq("product_id", productId);
  if (error) return { ok: false, reason: "error" };
  refresh();
  return { ok: true };
}
