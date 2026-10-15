import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * 브라우저용 Supabase 클라이언트. 로그인 쿠키를 그대로 쓰므로 RLS·Storage 정책이 사용자 기준으로 적용된다.
 * 지금은 리뷰 사진을 Storage에 직접 올릴 때만 쓴다.
 * 왜 서버를 거치지 않나: 서버 함수(Vercel)의 요청 크기 제한(약 4.5MB)이 허용 사진 크기(5MB)보다 작다.
 */
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  // 브라우저에서는 하나만 만들어 재사용한다 (요청마다 새로 만드는 서버와 다름)
  client ??= createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return client;
}
