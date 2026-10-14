import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * 이메일 인증 링크가 돌아오는 곳.
 * Supabase가 메일 링크를 검증한 뒤 `?code=...`를 붙여 이 주소로 보내면,
 * code를 세션(쿠키)으로 교환하고 원래 가려던 페이지로 이동시킨다. (PKCE 흐름)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // 실패하는 대표적인 경우: 가입한 브라우저가 아닌 곳(다른 기기·메일 앱 내장 브라우저)에서 링크를 열었을 때.
  // 이때도 이메일 인증 자체는 이미 끝났으므로 로그인만 하면 된다.
  const url = new URL("/login", origin);
  url.searchParams.set("notice", "link");
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}
