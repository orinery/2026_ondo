import { Suspense } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { getCurrentUser } from "@/lib/auth";
import { getCities, getSearchItems } from "@/lib/data/products";
import { createClient } from "@/lib/supabase/server";

/**
 * 일반 페이지 공통 레이아웃: 내비게이션 + 본문 + 푸터
 * 로그인 정보는 쿠키를 읽어야 하므로 Suspense로 감싸 스트리밍한다.
 * 그 사이에는 아바타 스켈레톤(명세 5.5 loading)이 보인다.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<SiteNav user={null} isUserLoading />}>
        <SiteNavWithUser />
      </Suspense>
      {/* 360: 하단 탭(64px + safe-area)에 내용이 가려지지 않게 여백을 둔다 */}
      <div className="flex flex-1 flex-col pb-[calc(--spacing(16)+env(safe-area-inset-bottom))] md:pb-0">
        <main id="main-content" className="flex flex-1 flex-col">
          {children}
        </main>
        <SiteFooter />
      </div>
    </>
  );
}

async function SiteNavWithUser() {
  const [user, searchItems, cities] = await Promise.all([
    getCurrentUser(),
    // 검색 팔레트(Command)에 쓸 상품·도시 목록 — 24개·6곳이라 한 번에 가져온다
    getSearchItems(),
    getCities(),
  ]);

  return (
    <SiteNav
      user={user ? { name: user.displayName, avatarUrl: user.avatarUrl } : null}
      searchItems={searchItems}
      searchCities={cities.map((c) => ({ slug: c.slug, name: c.name, nameEn: c.nameEn }))}
      cartCount={user ? await getCartCount() : 0}
    />
  );
}

/** 장바구니 배지 숫자 — 행 수만 센다(head: true → 데이터는 받지 않음). RLS로 본인 것만 */
async function getCartCount() {
  const supabase = await createClient();
  const { count } = await supabase.from("cart_items").select("id", { count: "exact", head: true });
  return count ?? 0;
}
