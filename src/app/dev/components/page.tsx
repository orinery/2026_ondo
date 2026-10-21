import type { Metadata } from "next";
import Image from "next/image";

import { ApplicationList } from "@/components/admin/application-list";
import { PartnerTable } from "@/components/admin/partner-table";
import { ConsoleLoading } from "@/components/console/console-loading";
import { ConsolePageHeader, ConsoleShell } from "@/components/console/console-shell";
import { UrlTabs } from "@/components/console/url-tabs";
import { ItineraryTimeline, TimelineSkeleton } from "@/components/itinerary/itinerary-timeline";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { CancellationPolicyTable } from "@/components/product/cancellation-policy-table";
import { FilterChip } from "@/components/product/filter-bar";
import { Gallery, GalleryEmpty, GallerySkeleton } from "@/components/product/gallery";
import {
  ProductCard,
  ProductCardEmpty,
  ProductCardSkeleton,
  ProductGrid,
} from "@/components/product/product-card";
import { CartView } from "@/components/cart/cart-view";
import { OrderList } from "@/components/orders/order-list";
import { CancelOrderDialog } from "@/components/orders/cancel-order-dialog";
import { ItemStatusBadge } from "@/components/orders/order-status-badge";
import { VoucherCard } from "@/components/orders/voucher-card";
import { PartnerApplyForm } from "@/components/partner/partner-apply-form";
import { MOCK_ITINERARY, MOCK_LONG_ITINERARY } from "@/lib/mock/itinerary";
import { MOCK_CART, MOCK_ORDERS } from "@/lib/mock/orders";
import { MOCK_APPLICATIONS, MOCK_PARTNERS, MOCK_REVIEWED_APPLICATIONS } from "@/lib/mock/partners";
import { MOCK_GALLERY, MOCK_PRODUCTS, unsplash } from "@/lib/mock/products";
import { seoulNow } from "@/lib/trip-dates";

import { BookingDemo } from "./_demos/booking-demo";
import { FilterDemo } from "./_demos/filter-demo";

export const metadata: Metadata = {
  title: "컴포넌트",
  description: "여운 디자인 시스템 — 공통 컴포넌트와 모든 상태",
  robots: { index: false, follow: false },
};

const [fuji] = MOCK_PRODUCTS as [(typeof MOCK_PRODUCTS)[number]];

const SEARCH_ITEMS = MOCK_PRODUCTS.map(({ slug, title, city }) => ({
  slug,
  title,
  cityName: city.name,
  cityNameEn: city.nameEn,
}));

const SEMANTIC_TOKENS = [
  ["background", "bg-background text-foreground"],
  ["foreground", "bg-foreground text-background"],
  ["card", "bg-card text-card-foreground"],
  ["primary", "bg-primary text-primary-foreground"],
  ["secondary", "bg-secondary text-secondary-foreground"],
  ["muted", "bg-muted text-muted-foreground"],
  ["accent", "bg-accent text-accent-foreground"],
  ["highlight", "bg-highlight text-highlight-foreground"],
  ["destructive", "bg-destructive text-destructive-foreground"],
  ["success", "bg-success text-background"],
  ["warning", "bg-warning text-background"],
  ["border", "bg-border text-foreground"],
  ["input", "bg-input text-foreground"],
  ["ring", "bg-ring text-background"],
] as const;

// Tailwind는 클래스 이름을 소스에서 정적으로 찾으므로 스케일 클래스를 문자열 그대로 나열한다
const SCALES = {
  moss: [
    "bg-moss-50",
    "bg-moss-100",
    "bg-moss-200",
    "bg-moss-300",
    "bg-moss-400",
    "bg-moss-500",
    "bg-moss-600",
    "bg-moss-700",
    "bg-moss-800",
    "bg-moss-900",
  ],
  lake: [
    "bg-lake-50",
    "bg-lake-100",
    "bg-lake-200",
    "bg-lake-300",
    "bg-lake-400",
    "bg-lake-500",
    "bg-lake-600",
    "bg-lake-700",
    "bg-lake-800",
    "bg-lake-900",
  ],
  glow: [
    "bg-glow-50",
    "bg-glow-100",
    "bg-glow-200",
    "bg-glow-300",
    "bg-glow-400",
    "bg-glow-500",
    "bg-glow-600",
    "bg-glow-700",
    "bg-glow-800",
    "bg-glow-900",
  ],
  stone: [
    "bg-stone-50",
    "bg-stone-100",
    "bg-stone-200",
    "bg-stone-300",
    "bg-stone-400",
    "bg-stone-500",
    "bg-stone-600",
    "bg-stone-700",
    "bg-stone-800",
    "bg-stone-900",
  ],
} as const;

const TYPE_SCALE = [
  ["text-5xl", "5xl · 56/64", "히어로 헤드라인"],
  ["text-4xl", "4xl · 40/50", "페이지 타이틀"],
  ["text-3xl", "3xl · 30/40", "섹션 타이틀"],
  ["text-2xl", "2xl · 24/34", "컬렉션 타일, 모달 타이틀"],
  ["text-xl", "xl · 20/30", "카드 여행지명"],
  ["text-lg", "lg · 18/28", "리드 문단, 탭"],
  ["text-base", "base · 16/26", "본문, 입력"],
  ["text-sm", "sm · 14/22", "메타 정보, 버튼, 칩"],
  ["text-xs", "xs · 12/18", "배지, 캡션"],
] as const;

export default function DevComponentsPage() {
  return (
    <>
      <SiteNav user={null} searchItems={SEARCH_ITEMS} />

      <main
        id="main-content"
        className="container flex flex-col gap-section-sm pt-10 pb-section-lg md:gap-section"
      >
        <header>
          <p className="font-display text-2xl text-muted-foreground italic">Design System</p>
          <h1 className="font-kr text-4xl font-semibold">컴포넌트 · 상태</h1>
          <p className="mt-2 text-muted-foreground">
            모든 공통 컴포넌트와 상태를 목업 데이터로 보여줍니다. 오른쪽 위 버튼으로 라이트/다크를
            전환해 보세요. hover·focus 같은 순간 상태는{" "}
            <code className="text-sm">data-preview</code>로 고정해 표시했습니다.
          </p>
        </header>

        <Section id="tokens" title="1. 디자인 토큰">
          <h3 className="text-lg font-semibold">시맨틱 토큰 (라이트/다크 전환됨)</h3>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {SEMANTIC_TOKENS.map(([name, cls]) => (
              <li
                key={name}
                className={`flex h-20 items-end rounded-md border p-2 text-xs font-medium ${cls}`}
              >
                --{name}
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-lg font-semibold">브랜드 스케일 (고정)</h3>
          <div className="flex flex-col gap-2">
            {Object.entries(SCALES).map(([name, classes]) => (
              <div key={name} className="grid grid-cols-[--spacing(14)_1fr] items-center gap-3">
                <span className="text-sm font-medium">{name}</span>
                <div className="grid grid-cols-10 overflow-hidden rounded-md border">
                  {classes.map((c, i) => (
                    <span
                      key={c}
                      className={`h-10 ${c}`}
                      title={`${name}-${i === 0 ? 50 : i * 100}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <h3 className="mt-4 text-lg font-semibold">타이포그래피</h3>
          <p className="font-display text-4xl">
            Kyoto, <i>in autumn</i>
          </p>
          <ul className="flex flex-col gap-2">
            {TYPE_SCALE.map(([cls, spec, use]) => (
              <li
                key={cls}
                className="grid gap-1 border-b pb-2 md:grid-cols-[--spacing(36)_1fr_--spacing(56)] md:items-baseline"
              >
                <span className="text-xs text-muted-foreground tabular-nums">{spec}</span>
                <span className={`font-kr font-semibold ${cls}`}>여운이 남는 여행</span>
                <span className="text-sm text-muted-foreground">{use}</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-lg font-semibold">Radius · Shadow</h3>
          <div className="flex flex-wrap gap-4">
            {(
              ["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-full"] as const
            ).map((r) => (
              <div
                key={r}
                className={`grid size-20 place-items-center border bg-card text-xs ${r}`}
              >
                {r.replace("rounded-", "")}
              </div>
            ))}
            {(["shadow-xs", "shadow-sm", "shadow-md", "shadow-lg", "shadow-focus"] as const).map(
              (s) => (
                <div
                  key={s}
                  className={`grid size-20 place-items-center rounded-md bg-card text-xs ${s}`}
                >
                  {s.replace("shadow-", "")}
                </div>
              ),
            )}
          </div>
        </Section>

        <Section id="card" title="2. 상품 카드 <ProductCard />">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
            <State label="default · 할인">
              <ProductCard likeMode="local" product={fuji} showReviewCount={false} />
            </State>
            <State label="hover · lift -4 · img 1.04">
              <ProductCard
                likeMode="local"
                product={fuji}
                showReviewCount={false}
                previewState="hover"
              />
            </State>
            <State label="active · focus ring · 찜됨">
              <ProductCard
                likeMode="local"
                product={fuji}
                showReviewCount={false}
                previewState="focus"
                initialLiked
              />
            </State>
            <State label="disabled · 판매 중지">
              <ProductCard
                likeMode="local"
                product={{ ...fuji, unavailableReason: "판매 준비 중" }}
                showReviewCount={false}
              />
            </State>
            <State label="loading · skeleton">
              <ProductCardSkeleton />
            </State>
            <State label="empty">
              <ProductCardEmpty />
            </State>
          </div>
          <h3 className="mt-4 text-lg font-semibold">그리드 (360 1열 · 768 2열 · 1280 4열)</h3>
          <ProductGrid>
            {MOCK_PRODUCTS.slice(0, 4).map((p) => (
              <ProductCard likeMode="local" key={p.id} product={p} initialLiked={p.id === "1"} />
            ))}
          </ProductGrid>
        </Section>

        <Section id="filter" title="3. 필터 바 <FilterBar />">
          <h3 className="text-lg font-semibold">칩 (테마) 상태</h3>
          <div className="flex flex-wrap gap-4">
            <State label="default">
              <FilterChip selected={false}>바다</FilterChip>
            </State>
            <State label="hover">
              <FilterChip selected={false} data-preview="hover">
                바다
              </FilterChip>
            </State>
            <State label="active">
              <FilterChip selected>바다</FilterChip>
            </State>
            <State label="focus-visible">
              <FilterChip selected={false} data-preview="focus">
                바다
              </FilterChip>
            </State>
            <State label="disabled">
              <FilterChip selected={false} disabled>
                빙하 · 0
              </FilterChip>
            </State>
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            실제 동작 (1023px 이하에서는 “필터” 버튼 → 하단 시트)
          </h3>
          <FilterDemo />
        </Section>

        <Section id="gallery" title="4. 갤러리 <Gallery />">
          <State label="default · 타일 클릭 → 라이트박스 (← → 키, 스와이프)">
            <Gallery images={MOCK_GALLERY} title="후지산 투어" />
          </State>
          <State label="hover (오른쪽 위 타일)">
            <Gallery images={MOCK_GALLERY} title="후지산 투어" previewHoverTile />
          </State>
          <div className="grid gap-6 md:grid-cols-2">
            <State label="disabled · 사진 1장">
              <Gallery images={MOCK_GALLERY.slice(0, 1)} title="후지산 투어" />
            </State>
            <State label="empty">
              <GalleryEmpty />
            </State>
          </div>
          <State label="loading">
            <GallerySkeleton />
          </State>
        </Section>

        <Section id="timeline" title="5. 일정 타임라인 <ItineraryTimeline />">
          <div className="grid gap-8 xl:grid-cols-2">
            <State label="default · current · 휴무(disabled) · Day 3 empty — 핸들을 끌어 순서 변경">
              <div className="rounded-lg border bg-card p-6">
                <ItineraryTimeline days={MOCK_ITINERARY} />
              </div>
            </State>
            <div className="flex flex-col gap-8">
              <State label="5일 여행 · Day 탭 줄바꿈">
                <div className="rounded-lg border bg-card p-6">
                  <ItineraryTimeline days={MOCK_LONG_ITINERARY} />
                </div>
              </State>
              <State label="hover · 핸들·삭제 노출">
                <div className="rounded-lg border bg-card p-6">
                  <ItineraryTimeline days={MOCK_ITINERARY.slice(1, 2)} previewHoverItemId="i4" />
                </div>
              </State>
              <State label="loading">
                <div className="rounded-lg border bg-card p-6">
                  <TimelineSkeleton />
                </div>
              </State>
            </div>
          </div>
        </Section>

        <Section id="nav" title="6. 반응형 내비게이션 <SiteNav />">
          <p className="text-sm text-muted-foreground">
            창 너비를 360 / 768 / 1280으로 바꿔 보세요. 360에서는 화면 맨 아래에 하단 탭이
            고정됩니다.
          </p>
          <State label="비로그인 · '나의 여행' disabled (툴팁)">
            <NavFrame>
              <SiteNav user={null} preview searchItems={SEARCH_ITEMS} />
            </NavFrame>
          </State>
          <State label="loading avatar">
            <NavFrame>
              <SiteNav user={null} isUserLoading preview searchItems={SEARCH_ITEMS} />
            </NavFrame>
          </State>
          <State label="로그인">
            <NavFrame>
              <SiteNav
                user={{ name: "여운", avatarUrl: null, role: "customer" }}
                preview
                searchItems={SEARCH_ITEMS}
                cartCount={2}
              />
            </NavFrame>
          </State>
          <State label="히어로 위 (투명)">
            <NavFrame className="relative h-48">
              <Image
                src={unsplash("1493976040374-85c8e12f0c0e", 1600)}
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-b from-stone-900/45 to-transparent" />
              <SiteNav user={null} overHero preview searchItems={SEARCH_ITEMS} />
            </NavFrame>
          </State>
        </Section>

        <Section id="booking" title="7. 예약 위젯 <BookingPanel /> · 취소 규정">
          <p className="text-sm text-muted-foreground">
            명세 밖 쇼핑몰 화면이라 기존 토큰·컴포넌트(Calendar, Button, 카드 보더)로 구성했다. 1023
            이하 상세에서는 하단 고정 바 → 하단 시트에 같은 내용이 열린다.
          </p>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <BookingDemo today={seoulNow().today} />
            <div className="flex flex-col gap-6">
              <CancellationPolicyTable
                name="일반 취소"
                summary="7일 전까지 100% · 3일 전까지 50% · 1일 전까지 20% 환불"
                tiers={[
                  { daysBefore: 7, refundRate: 100 },
                  { daysBefore: 3, refundRate: 50 },
                  { daysBefore: 1, refundRate: 20 },
                ]}
              />
              <CancellationPolicyTable
                name="무료 취소"
                summary="이용일 1일 전까지 전액 환불"
                tiers={[{ daysBefore: 1, refundRate: 100 }]}
              />
              <CancellationPolicyTable
                name="환불 불가"
                summary="특가 상품으로 결제 후에는 환불되지 않아요"
                tiers={[{ daysBefore: 0, refundRate: 0 }]}
              />
            </div>
          </div>
        </Section>

        <Section id="orders" title="8. 장바구니 · 예약 내역 · 예약 취소">
          <p className="text-sm text-muted-foreground">
            명세 밖 쇼핑몰 화면 — 기존 토큰·컴포넌트로 구성. 목업 데이터라 인원 변경·삭제·취소
            버튼은 &quot;로그인 필요&quot;로 실패한다.
          </p>
          <h3 className="text-lg font-semibold">장바구니 (주문 가능 1 · 마감 지난 항목 1)</h3>
          <div className="rounded-lg border p-4 md:p-6">
            <CartView items={MOCK_CART} preview />
          </div>
          <h3 className="mt-4 text-lg font-semibold">예약 내역 (이용 예정 · 이용 완료 · 취소)</h3>
          <OrderList orders={MOCK_ORDERS} status="all" />
          <h3 className="mt-4 text-lg font-semibold">예약 취소 확인 창 (환불 예정액)</h3>
          <div>
            <CancelOrderDialog
              target={{ kind: "order", orderId: "00000000-0000-0000-0000-000000000000" }}
              orderNo="YO261015-000031"
              lines={[
                {
                  title: "후지산·가와구치코 당일 버스 투어",
                  daysBefore: 5,
                  refundRate: 50,
                  refundAmount: 89000,
                },
              ]}
            />
          </div>
          <h3 className="mt-4 text-lg font-semibold">상품별 예약 상태 배지</h3>
          <div className="flex flex-wrap gap-2">
            {(
              [
                "pending",
                "processing",
                "confirmed",
                "used",
                "rejected",
                "cancelled",
                "expired",
              ] as const
            ).map((s) => (
              <ItemStatusBadge key={s} status={s} />
            ))}
          </div>
          <h3 className="mt-4 text-lg font-semibold">모바일 바우처 (예약 확정)</h3>
          <VoucherCard
            code="B362D132E0"
            title="후지산·가와구치코 당일 버스 투어"
            useDate="2026-11-21"
            startTime="08:00"
            people={3}
            className="max-w-md"
          />
          <h3 className="mt-4 text-lg font-semibold">빈 상태</h3>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CartView items={[]} preview />
            <OrderList orders={[]} status="all" label="예약 내역 (빈 상태)" />
          </div>
        </Section>

        <Section id="console" title="9. 파트너 신청 · 관리자 콘솔">
          <p className="text-sm text-muted-foreground">
            명세 밖 화면 — 기존 토큰·컴포넌트로 구성. 콘솔은 767 이하에서 상단 바 + 메뉴 시트, 768
            이상에서 왼쪽 사이드바. 목업이라 승인·거절·제출 버튼은 &quot;로그인 필요&quot;로
            실패한다.
          </p>
          <h3 className="text-lg font-semibold">파트너 신청서</h3>
          <div className="max-w-3xl rounded-lg border p-4 md:p-6">
            <PartnerApplyForm defaults={{ name: "여운", email: "me@example.com" }} />
          </div>

          <h3 className="mt-4 text-lg font-semibold">관리자 콘솔 · 검토 대기</h3>
          <NavFrame>
            <ConsoleShell section="admin" userName="관리자" preview>
              <div className="flex flex-col gap-6 px-4 py-8 md:px-8">
                <ConsolePageHeader
                  as="h2"
                  eyebrow="Partners"
                  title="파트너 관리"
                  description="파트너 신청을 검토하고, 활동 중인 파트너를 관리해요."
                />
                <UrlTabs
                  label="파트너 관리 메뉴 (미리보기)"
                  current="pending"
                  tabs={[
                    { value: "pending", label: "검토 대기", href: "#console", count: 1 },
                    { value: "done", label: "처리된 신청", href: "#console" },
                    { value: "partners", label: "파트너", href: "#console" },
                  ]}
                />
                <ApplicationList applications={MOCK_APPLICATIONS} reviewable />
              </div>
            </ConsoleShell>
          </NavFrame>

          <h3 className="mt-4 text-lg font-semibold">처리된 신청 · 빈 상태</h3>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ApplicationList applications={MOCK_REVIEWED_APPLICATIONS} />
            <ApplicationList applications={[]} reviewable />
          </div>

          <h3 className="mt-4 text-lg font-semibold">
            파트너 목록 (활동 중 · 이용 정지 · 계정 없음)
          </h3>
          <PartnerTable partners={MOCK_PARTNERS} />

          <h3 className="mt-4 text-lg font-semibold">콘솔 로딩</h3>
          <div className="rounded-lg border">
            <ConsoleLoading />
          </div>
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-5">
      <h2 id={`${id}-title`} className="border-b pb-3 font-kr text-3xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function State({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2.5">
      {children}
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

function NavFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`overflow-hidden rounded-lg border ${className ?? ""}`}>{children}</div>;
}
