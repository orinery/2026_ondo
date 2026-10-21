import type { NextConfig } from "next";

// 리뷰 사진(Supabase Storage 공개 URL)을 next/image로 최적화하기 위해 프로젝트 호스트를 허용한다
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  // Cache Components(cacheComponents/partialPrefetching)는 쓰지 않는다.
  // 왜: 로그인 상태를 쿠키로 읽는 Supabase SSR 구조에서는 쿠키를 읽는 페이지가
  // 자동으로 동적 렌더링되는 기존 모델이 더 단순하고 공식 예제와도 일치하기 때문.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // 쇼핑몰 전환 전의 여행지 주소(/destinations)로 들어오면 상품 목록으로 보낸다.
  // 예전 여행지 slug는 상품과 1:1로 대응하지 않으므로 상세 주소도 목록으로 보낸다 (영구 이동 308)
  async redirects() {
    return [
      { source: "/destinations", destination: "/products", permanent: true },
      // 예전 여행지 중 일본 도시(교토·도쿄)는 그 도시의 상품 목록으로
      { source: "/destinations/kyoto", destination: "/products?city=kyoto", permanent: true },
      { source: "/destinations/tokyo", destination: "/products?city=tokyo", permanent: true },
      { source: "/destinations/:slug", destination: "/products", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      // 상품·도시 이미지(Unsplash 무료 이미지)
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/review-photos/**",
            },
            // 파트너가 올린 상품 사진 (S4)
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/product-images/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
