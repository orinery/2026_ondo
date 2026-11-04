import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * 로그인과 무관한 서버 작업용 Supabase 클라이언트 — 쿠키를 읽지 않고 항상 anon 역할로 동작한다.
 * 쓰는 곳: 퍼널 이벤트 수집(/api/events), sitemap.xml.
 * 왜 따로: 쿠키를 읽으면 요청마다 다시 실행되는 동적 경로가 되고(sitemap 캐시 불가),
 * 쿠키의 토큰이 만료돼 있으면 로그인과 무관한 요청까지 실패한다.
 */
export function createPublicClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
