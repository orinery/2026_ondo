import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

/**
 * 현재 로그인한 사용자 (Data Access Layer).
 * - getClaims(): 쿠키의 JWT 서명을 검증한다. 쿠키 값만 믿는 getSession()과 달리 위조된 쿠키를 걸러낸다.
 * - cache(): 한 번의 요청 안에서 레이아웃·페이지가 여러 번 불러도 실제 조회는 한 번만 한다.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  const { sub: id, email } = data.claims;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", id)
    .maybeSingle();

  return {
    id,
    email: email ?? null,
    // 프로필은 가입 트리거가 만들지만, 혹시 없을 때도 화면이 깨지지 않게 대체값을 둔다
    displayName: profile?.display_name ?? email?.split("@")[0] ?? "여행자",
    avatarUrl: profile?.avatar_url ?? null,
  };
});

/**
 * 로그인이 필요한 페이지·Server Action에서 호출한다.
 * proxy의 리다이렉트는 우회될 수 있으므로(예: Server Action 직접 호출) 데이터에 가까운 곳에서 다시 확인한다.
 */
export async function requireUser(nextPath = "/my"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}
