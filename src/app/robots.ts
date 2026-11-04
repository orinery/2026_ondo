import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";

/**
 * robots.txt (Quick Win Q5) — 검색엔진이 볼 필요 없는 화면은 크롤링하지 않게 한다.
 * 로그인이 필요한 화면(proxy.ts 보호 경로)·콘솔·쇼케이스·API. 각 페이지의 robots: noindex는 그대로 둔다
 * (robots.txt는 "가져가지 말라"이고 noindex는 "색인하지 말라"라 서로 보완한다).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/my",
        "/cart",
        "/checkout",
        "/partner",
        "/partner-apply",
        "/admin",
        "/dev",
        "/api",
      ],
    },
    sitemap: `${publicEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
