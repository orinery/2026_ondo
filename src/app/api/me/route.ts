import { getCurrentUser } from "@/lib/auth";
import { getCartCount } from "@/lib/data/cart";
import { getLikedIds } from "@/lib/data/likes";
import type { ViewerSnapshot } from "@/lib/viewer";

/**
 * 지금 보는 사람 정보 (GET /api/me, S2 속도 개선) — 내비 아바타·장바구니 수·찜한 상품 id.
 * 공개 페이지는 사람과 무관한 HTML을 엣지 캐시에서 내려주고, 이 값만 브라우저가 따로 불러온다
 * (src/components/viewer/viewer-provider.tsx). 읽기 전용이라 Route Handler로 둔다.
 * proxy를 거치므로 만료된 토큰은 여기서도 갱신된다. 응답은 사람마다 다르니 어디에도 캐시하지 않는다.
 */
export async function GET() {
  const user = await getCurrentUser();
  const body: ViewerSnapshot = user
    ? {
        user: { id: user.id, name: user.displayName, avatarUrl: user.avatarUrl, role: user.role },
        ...(await Promise.all([getCartCount(), getLikedIds()]).then(([cartCount, likedIds]) => ({
          cartCount,
          likedIds,
        }))),
      }
    : { user: null, cartCount: 0, likedIds: [] };
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
