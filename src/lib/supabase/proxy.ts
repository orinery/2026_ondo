import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * 매 요청마다 Supabase 세션을 확인하고, 만료된 access token을 갱신해 쿠키에 다시 쓴다.
 * 왜 proxy에서 하나: Server Component는 쿠키를 쓸 수 없어서 토큰 갱신 결과를 저장할 곳이
 * 요청 앞단(proxy)과 Server Action·Route Handler뿐이기 때문.
 *
 * 반환한 response를 그대로 돌려줘야 갱신된 쿠키가 브라우저에 전달된다.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          // 1) 이번 요청을 처리할 서버 코드가 새 토큰을 읽을 수 있도록 요청 쿠키를 갱신하고
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          // 2) 브라우저가 새 토큰을 저장하도록 응답 쿠키에도 쓴다
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // 3) 인증 쿠키가 담긴 응답이 CDN에 캐시되지 않게 하는 헤더 (라이브러리 제공)
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // getClaims(): JWT 서명을 검증하고 필요하면 토큰을 갱신한다. (getSession()은 검증하지 않아 서버에서 신뢰 불가)
  // 이 호출과 createServerClient 사이에 다른 코드를 넣지 않는다 — 세션이 꼬일 수 있다(공식 가이드).
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;

  return { response, userId };
}
