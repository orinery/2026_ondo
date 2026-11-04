import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

// 파트너가 상품을 새로 공개해도 1시간 안에 반영된다 (빌드 때 한 번 만들고 그 뒤 주기적으로 다시 만든다)
export const revalidate = 3600;

/**
 * XML 특수 문자 이스케이프. Next.js(16.4)는 사이트맵 값을 그대로 이어 붙여서, Unsplash 사진 주소의
 * "&"(…?auto=format&fit=crop)가 들어가면 XML 자체가 깨진다 → 주소는 직접 이스케이프해서 넘긴다
 */
const xml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/**
 * sitemap.xml (Quick Win Q5) — 검색엔진에 공개 페이지 목록을 알려 준다.
 * - 상품: 공개됐고 관리자 판매 중지가 아닌 것만 (공개 목록과 같은 기준), 대표 사진은 이미지 사이트맵으로
 * - 도시별 목록: 목록 화면이 쿼리 주소(/products?city=…)라 그대로 넣는다
 * - 로그인이 필요한 화면·콘솔은 넣지 않는다 (robots.ts에서도 막는다)
 * 쿠키 없이 anon으로 읽는다 — 누구에게나 같은 내용이라 캐시할 수 있게.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const supabase = createPublicClient();
  const [products, cities] = await Promise.all([
    supabase
      .from("products")
      .select("slug, image_url")
      .not("published_at", "is", null)
      .is("suspended_reason", null)
      .order("slug"),
    supabase.from("cities").select("slug").order("position"),
  ]);
  if (products.error) throw products.error;
  if (cities.error) throw cities.error;

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.9 },
    ...cities.data.map((c) => ({
      url: `${base}/products?city=${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.data.map((p) => ({
      url: `${base}/products/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: [xml(p.image_url)],
    })),
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.1 },
  ];
}
