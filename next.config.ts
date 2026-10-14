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
  images: {
    remotePatterns: [
      // 여행지 이미지(Unsplash 무료 이미지)
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/review-photos/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
