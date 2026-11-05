import type { UserRole } from "@/lib/constants/taxonomy";

/**
 * 지금 보는 사람(로그인 사용자) 정보 — GET /api/me 응답 (S2 속도 개선).
 * 공개 페이지(메인·상품 상세)는 모두에게 같은 HTML을 엣지 캐시에서 내려주고,
 * 사람마다 다른 부분(내비 아바타·장바구니 수·찜 하트·리뷰 권한)만 브라우저가 이 API로 따로 불러온다.
 */
export type ViewerUser = { id: string; name: string; avatarUrl: string | null; role: UserRole };

export type ViewerSnapshot = {
  user: ViewerUser | null; // null = 비로그인
  cartCount: number;
  likedIds: string[];
};

/** GET /api/me/review?product= — 상세의 리뷰 쓰기 버튼용 (내 리뷰는 숨김 처리돼도 본인에게는 보인다) */
export type ViewerReview = {
  canReview: boolean;
  myReview: {
    id: string;
    rating: number;
    content: string;
    photoUrl: string | null;
    hidden: boolean;
  } | null;
};
