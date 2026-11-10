import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * 지금 탈퇴할 수 없는 이유 코드 (없으면 null) — 계정 설정 화면에 미리 보여 준다.
 * 판단은 DB 함수 account_deletion_blocker (0040). 실제 탈퇴 때 delete_my_account가 한 번 더 확인한다.
 */
export async function getDeletionBlocker(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("account_deletion_blocker");
  if (error) throw error;
  return data ?? null;
}
