import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { USER_ROLE_VALUES, type PartnerStatus, type UserRole } from "@/lib/constants/taxonomy";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  // 파트너 계정이면 소속 파트너 (이용 정지 상태여도 채운다 → 콘솔에서 안내용)
  partner: { id: string; name: string; status: PartnerStatus } | null;
};

const isRole = (value: unknown): value is UserRole =>
  USER_ROLE_VALUES.some((role) => role === value);

/**
 * 현재 로그인한 사용자 (Data Access Layer).
 * - getClaims(): 쿠키의 JWT 서명을 검증한다. 쿠키 값만 믿는 getSession()과 달리 위조된 쿠키를 걸러낸다.
 * - cache(): 한 번의 요청 안에서 레이아웃·페이지가 여러 번 불러도 실제 조회는 한 번만 한다.
 * - 역할은 공개 프로필에서 읽을 수 없게 막아 두었으므로(0010) my_profile() 함수로 본인 것만 읽는다.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  const { sub: id, email } = data.claims;
  const { data: rows } = await supabase.rpc("my_profile");
  const profile = rows?.[0];

  // 함수가 돌려주는 left join 값은 생성 타입에서 null이 빠져 있어 직접 확인한다
  const partnerId: string | null = profile?.partner_id ?? null;
  const partnerStatus: string | null = profile?.partner_status ?? null;

  return {
    id,
    email: email ?? null,
    // 프로필은 가입 트리거가 만들지만, 혹시 없을 때도 화면이 깨지지 않게 대체값을 둔다
    displayName: profile?.display_name ?? email?.split("@")[0] ?? "여행자",
    avatarUrl: profile?.avatar_url ?? null,
    role: isRole(profile?.role) ? profile.role : "customer",
    partner:
      partnerId && (partnerStatus === "active" || partnerStatus === "suspended")
        ? { id: partnerId, name: profile?.partner_name ?? "", status: partnerStatus }
        : null,
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

/**
 * 콘솔(파트너 센터·관리자) 페이지용 역할 확인.
 * - 관리자 화면: 관리자가 아니면 404 — 관리자 화면이 있다는 사실도 드러내지 않는다.
 * - 파트너 화면: 파트너가 아니면 파트너 신청 페이지로 안내한다.
 * 최종 권한은 DB(RLS·함수 안의 is_admin()/my_partner_id())가 다시 확인한다.
 */
export async function requireRole(role: "partner" | "admin", nextPath: string) {
  const user = await requireUser(nextPath);
  if (user.role === role) return user;
  if (role === "admin") notFound();
  redirect("/partner-apply");
}
