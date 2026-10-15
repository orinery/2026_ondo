import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// 로그인이 필요한 경로
const PROTECTED_PREFIXES = ["/my", "/cart", "/checkout"];
// 로그인한 사용자가 들어올 필요가 없는 경로
const AUTH_PAGES = ["/login", "/signup"];

/**
 * Next.js 16의 Proxy(구 Middleware). 모든 페이지 요청 앞에서 실행된다.
 * 1) Supabase 세션 갱신
 * 2) 보호된 경로의 "낙관적" 접근 제어 — 빠른 리다이렉트용일 뿐이고,
 *    실제 권한 검사는 각 페이지의 requireUser()와 DB의 RLS가 다시 한다(다중 방어).
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (userId && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/my";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // 정적 파일·이미지 최적화 요청에는 실행하지 않는다 (불필요한 인증 호출 방지)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
