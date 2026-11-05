import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { canReviewProduct, getMyReview } from "@/lib/data/products";
import type { ViewerReview } from "@/lib/viewer";

const query = z.object({ product: z.uuid() });

/**
 * 상품 상세의 리뷰 쓰기·수정 버튼용 (GET /api/me/review?product=상품id, S2).
 * 상세 페이지는 캐시되므로 "내 리뷰가 있는지 / 이용을 마쳐 새로 쓸 수 있는지"는 브라우저가 따로 묻는다.
 */
export async function GET(request: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return new Response(null, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  const productId = parsed.data.product;
  const myReview = await getMyReview(productId, user.id);
  const body: ViewerReview = {
    myReview,
    // 상품당 리뷰 1개(사용자 확정) → 이미 썼으면 새로 쓸 수 있는지 물을 필요가 없다
    canReview: myReview ? false : await canReviewProduct(productId),
  };
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
