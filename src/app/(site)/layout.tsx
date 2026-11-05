import { SiteFooter } from "@/components/layout/site-footer";
import { ViewerProvider } from "@/components/viewer/viewer-provider";
import { ViewerSiteNav } from "@/components/viewer/viewer-site-nav";
import { getCities, getSearchItems } from "@/lib/data/products";

/**
 * 일반 페이지 공통 레이아웃: 내비게이션 + 본문 + 푸터
 * 쿠키(로그인 정보)를 읽지 않는다 (S2 속도 개선) — 그래야 메인·상품 상세를 미리 만들어 엣지 캐시에서 내려줄 수 있다.
 * 아바타·장바구니 수·찜은 ViewerProvider가 브라우저에서 /api/me로 불러온다 (그 사이엔 아바타 스켈레톤, 명세 5.5 loading).
 */
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  // 검색 팔레트(Command)에 쓸 상품·도시 목록 — 24개·6곳이라 한 번에 가져온다 (공개 데이터)
  const [searchItems, cities] = await Promise.all([getSearchItems(), getCities()]);

  return (
    <ViewerProvider>
      <ViewerSiteNav
        searchItems={searchItems}
        searchCities={cities.map((c) => ({ slug: c.slug, name: c.name, nameEn: c.nameEn }))}
      />
      {/* 360: 하단 탭(64px + safe-area)에 내용이 가려지지 않게 여백을 둔다 */}
      <div className="flex flex-1 flex-col pb-[calc(--spacing(16)+env(safe-area-inset-bottom))] md:pb-0 print:pb-0">
        <main id="main-content" className="flex flex-1 flex-col">
          {children}
        </main>
        <SiteFooter />
      </div>
    </ViewerProvider>
  );
}
