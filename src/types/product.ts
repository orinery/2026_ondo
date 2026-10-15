import type { CategorySlug, ThemeSlug } from "@/lib/constants/taxonomy";

/**
 * 화면(카드·목록)에 필요한 상품 요약 정보.
 * DB 스키마와 분리한 "뷰 모델"이다. DB 행 → 이 타입 변환은 src/lib/data/products.ts가 맡는다.
 * 왜 분리하나: DB 컬럼이 바뀌어도 컴포넌트는 그대로 둘 수 있게 하기 위해서.
 */
export type ProductSummary = {
  id: string;
  slug: string;
  title: string;
  city: { slug: string; name: string; nameEn: string };
  category: CategorySlug;
  theme: ThemeSlug;
  imageUrl: string;
  imageAlt: string;
  adultPrice: number; // 원
  listAdultPrice: number | null; // 정가 (할인 표시)
  rating: number; // 0–5
  reviewCount: number;
  // 값이 있으면 disabled 카드로 표시하고 사유 배지에 이 문구를 보여준다 (명세 5.1 Disabled)
  unavailableReason: string | null;
};

export type CitySummary = {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  summary: string;
  imageUrl: string;
  imageAlt: string;
};

export type GalleryImage = {
  src: string;
  alt: string;
  // LQIP(blur-up)용 data URL. 없으면 muted 배경만 보인다 (명세 5.3 loading)
  blurDataURL?: string;
};
