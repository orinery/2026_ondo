import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import { funnelEventSchema } from "@/lib/validation/funnel-event";
import type { Database } from "@/types/database";

/**
 * 퍼널 이벤트 수집 (POST /api/events) — 브라우저의 navigator.sendBeacon이 보낸다 (src/lib/track.ts).
 * 데이터 변경은 원래 Server Action으로만 하지만, Server Action은 한 번에 하나씩 차례로 실행돼
 * 측정 요청이 장바구니 담기 같은 실제 동작을 기다리게 만들고, 페이지를 떠나면 끊긴다 → 여기만 예외.
 *
 * 누가 보냈는지는 기록하지 않으므로 로그인 쿠키 없이 anon 역할로 넣는다
 * (쿠키의 토큰이 만료돼 있어도 실패하지 않게). DB는 insert 4개 컬럼만 허용한다 (0035).
 */
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = funnelEventSchema.safeParse(raw);
  if (!parsed.success) return new Response(null, { status: 400 });

  const { name, sessionId, productId, device } = parsed.data;
  const supabase = createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await supabase
    .from("funnel_events")
    .insert({ name, session_id: sessionId, product_id: productId ?? null, device });
  // 없는 상품 id(FK) 등 — 측정 실패는 사용자에게 영향이 없으므로 기록만 하지 않는다
  return new Response(null, { status: error ? 422 : 204 });
}
