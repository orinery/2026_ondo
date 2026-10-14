import type { SeasonSlug, ThemeSlug } from "@/lib/constants/taxonomy";

/**
 * 화면(카드·목록)에 필요한 여행지 요약 정보.
 * DB 스키마와 분리한 "뷰 모델"이다. 3단계에서 DB 행 → 이 타입으로 변환하는 함수를 둔다.
 * 왜 분리하나: DB 컬럼이 바뀌어도 컴포넌트는 그대로 둘 수 있게 하기 위해서.
 */
export type DestinationSummary = {
  id: string;
  slug: string;
  name: string; // 한글명
  nameEn: string; // 영문명 (Instrument Serif로 표시)
  country: string;
  theme: ThemeSlug;
  season: SeasonSlug; // 추천 계절 (시즌 배지)
  imageUrl: string;
  imageAlt: string;
  rating: number; // 0–5
  reviewCount: number;
  // 값이 있으면 disabled 카드로 표시하고 사유 배지에 이 문구를 보여준다 (명세 5.1 Disabled)
  unavailableReason?: string | null;
};

export type GalleryImage = {
  src: string;
  alt: string;
  // LQIP(blur-up)용 data URL. 없으면 muted 배경만 보인다 (명세 5.3 loading)
  blurDataURL?: string;
};
