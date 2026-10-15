import type { Metadata } from "next";
import Image from "next/image";

import {
  DestinationCard,
  DestinationCardEmpty,
  DestinationCardSkeleton,
  DestinationGrid,
} from "@/components/destination/destination-card";
import { FilterChip } from "@/components/destination/filter-bar";
import { Gallery, GalleryEmpty, GallerySkeleton } from "@/components/destination/gallery";
import { ItineraryTimeline, TimelineSkeleton } from "@/components/itinerary/itinerary-timeline";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { MOCK_DESTINATIONS, MOCK_GALLERY, unsplash } from "@/lib/mock/destinations";
import { MOCK_ITINERARY } from "@/lib/mock/itinerary";

import { FilterDemo } from "./_demos/filter-demo";

export const metadata: Metadata = {
  title: "컴포넌트",
  description: "여운 디자인 시스템 — 공통 컴포넌트와 모든 상태",
  robots: { index: false, follow: false },
};

const [kyoto, santorini, dolomites, paris] = MOCK_DESTINATIONS as [
  (typeof MOCK_DESTINATIONS)[number],
  (typeof MOCK_DESTINATIONS)[number],
  (typeof MOCK_DESTINATIONS)[number],
  (typeof MOCK_DESTINATIONS)[number],
];

const SEARCH_ITEMS = MOCK_DESTINATIONS.map(({ slug, name, nameEn, country }) => ({
  slug,
  name,
  nameEn,
  country,
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

        <Section id="card" title="2. 여행지 카드 <DestinationCard />">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
            <State label="default">
              <DestinationCard likeMode="local" destination={kyoto} showReviewCount={false} />
            </State>
            <State label="hover · lift -4 · img 1.04">
              <DestinationCard
                likeMode="local"
                destination={kyoto}
                showReviewCount={false}
                previewState="hover"
              />
            </State>
            <State label="active · focus ring · 찜됨">
              <DestinationCard
                likeMode="local"
                destination={kyoto}
                showReviewCount={false}
                previewState="focus"
                initialLiked
              />
            </State>
            <State label="disabled">
              <DestinationCard
                likeMode="local"
                destination={{ ...kyoto, unavailableReason: "현재 여행 제한" }}
                showReviewCount={false}
              />
            </State>
            <State label="loading · skeleton">
              <DestinationCardSkeleton />
            </State>
            <State label="empty">
              <DestinationCardEmpty />
            </State>
          </div>
          <h3 className="mt-4 text-lg font-semibold">그리드 (360 1열 · 768 2열 · 1280 4열)</h3>
          <DestinationGrid>
            {[kyoto, santorini, dolomites, paris].map((d) => (
              <DestinationCard
                likeMode="local"
                key={d.id}
                destination={d}
                initialLiked={d.id === "1"}
              />
            ))}
          </DestinationGrid>
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
            <Gallery images={MOCK_GALLERY} title="교토" />
          </State>
          <State label="hover (오른쪽 위 타일)">
            <Gallery images={MOCK_GALLERY} title="교토" previewHoverTile />
          </State>
          <div className="grid gap-6 md:grid-cols-2">
            <State label="disabled · 사진 1장">
              <Gallery images={MOCK_GALLERY.slice(0, 1)} title="교토" />
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
                user={{ name: "여운", avatarUrl: null }}
                preview
                searchItems={SEARCH_ITEMS}
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
