import type { NextConfig } from "next";

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
    ],
  },
};

export default nextConfig;
