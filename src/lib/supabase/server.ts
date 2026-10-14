import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * 서버(Server Component · Server Action · Route Handler)용 Supabase 클라이언트.
 * 요청마다 새로 만든다 — 클라이언트를 요청 사이에 공유하면 다른 사용자의 세션이 섞일 수 있다.
 *
 * publishable 키 + 요청 쿠키의 사용자 JWT로 동작하므로 모든 쿼리에 RLS가 적용된다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component에서는 쿠키를 쓸 수 없어 에러가 난다.
            // 세션 갱신은 proxy.ts가 매 요청마다 처리하므로 여기서는 무시해도 안전하다.
          }
        },
      },
    },
  );
}
