import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { DestinationCard } from "@/components/destination/destination-card";
import { HeroSearch } from "@/components/home/hero-search";
import { COLLECTIONS, SEASON_EDITS } from "@/lib/constants/season-edits";
import { getFeaturedDestinations, getThemeTotals } from "@/lib/data/destinations";
import { getLikedIds } from "@/lib/data/likes";
import { englishMonth, seasonOf, seoulYear } from "@/lib/season";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  // 메인은 레이아웃의 기본 제목("여운 Yeoun")을 그대로 쓴다
  description:
    "떠나기 전의 설렘이 돌아온 뒤의 여운으로. 계절에 맞는 여행지를 찾고, 찜하고, 날짜별 일정을 만들어 보세요.",
};

/** 메인 (명세 4.1): 히어로 → 추천 여행지 → 테마별 컬렉션 */
export default async function HomePage() {
  const now = new Date();
  const season = seasonOf(now);
  const edit = SEASON_EDITS[season];
  const [featured, themeTotals, likedIds] = await Promise.all([
    getFeaturedDestinations(season),
    getThemeTotals(),
    getLikedIds(),
  ]);

  return (
    <>
      {/* ── 히어로: 풀블리드 사진 + 하단 스크림 (높이 480 / 560 / 640) ── */}
      <section
        aria-labelledby="hero-title"
        className="relative h-120 overflow-hidden bg-stone-700 md:h-140 xl:h-160"
      >
        <Image
          src={edit.image}
          alt={edit.imageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* 위쪽(투명 내비 가독성)과 아래쪽(헤드라인 가독성)을 어둡게 */}
        <div className="absolute inset-0 bg-linear-to-b from-stone-900/45 via-transparent via-35% to-stone-900/60" />
        <div className="relative container flex h-full flex-col justify-end pb-10 text-white md:pb-14">
          <p className="font-display text-xl italic md:text-2xl">
            {edit.eyebrow} — {seoulYear(now)}
          </p>
          <h1
            id="hero-title"
            className="mt-2.5 max-w-190 font-kr text-4xl font-semibold xl:text-5xl"
          >
            {edit.headline[0]}
            {/* 360에서는 40px 글자가 강제 줄바꿈과 겹쳐 어색하게 끊기므로, 768 이상에서만 명세대로 줄을 나눈다 */}
            <br className="hidden md:inline" />
            <span className="md:hidden"> </span>
            {edit.headline[1]}
          </h1>
          <HeroSearch />
        </div>
      </section>

      {/* ── 추천 여행지: 시즌 큐레이션 (1280 4열 · 768 2.5열 스크롤 · 360 1.3열 스냅) ── */}
      <section
        aria-labelledby="featured-title"
        className="container pt-section-sm md:pt-section xl:pt-24"
      >
        <SectionHeader
          eyebrow={`Picked for ${englishMonth(now)}`}
          title="지금 떠나기 좋은 여행지"
          titleId="featured-title"
          action={{ href: `/destinations?season=${season}`, label: "전체 보기 →" }}
        />
        {featured.length === 0 ? (
          <p className="rounded-lg border-[1.5px] border-dashed border-input py-16 text-center text-muted-foreground">
            이번 계절에 추천할 여행지를 준비하고 있어요.
          </p>
        ) : (
          // 가로 스크롤 영역은 화면 끝까지 닿도록 container 여백만큼 바깥으로 늘린다
          <ul className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-6 overflow-x-auto px-5 pb-2 md:-mx-8 md:scroll-px-8 md:px-8 xl:mx-0 xl:grid xl:grid-cols-4 xl:overflow-visible xl:px-0">
            {featured.map((d, i) => (
              <li key={d.id} className="w-[76%] shrink-0 snap-start md:w-[38%] xl:w-auto">
                <DestinationCard
                  destination={d}
                  initialLiked={likedIds.includes(d.id)}
                  showReviewCount={false}
                  priority={i < 2}
                  sizes="(min-width: 1280px) 300px, (min-width: 768px) 38vw, 76vw"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 테마별 컬렉션: 대형 1 + 소형 2 (1024 미만 세로 스택, 3:2) ── */}
      <section
        id="collections"
        aria-labelledby="collections-title"
        className="container scroll-mt-20 py-section-sm md:py-section xl:py-section-lg"
      >
        <SectionHeader
          eyebrow="Collections"
          title="취향대로 고르는 테마 여행"
          titleId="collections-title"
        />
        <ul className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:grid-rows-[repeat(2,--spacing(70))]">
          {COLLECTIONS.map((c, i) => {
            const large = i === 0;
            const count = themeTotals[c.theme] ?? 0;
            return (
              <li
                key={c.theme}
                className={cn(large ? "lg:col-span-7 lg:row-span-2" : "lg:col-span-5")}
              >
                <Link
                  href={`/destinations?theme=${c.theme}`}
                  className="group relative block aspect-tile overflow-hidden rounded-xl bg-muted lg:aspect-auto lg:h-full"
                >
                  <Image
                    src={c.image}
                    alt={c.imageAlt}
                    fill
                    sizes={
                      large ? "(min-width: 1024px) 58vw, 100vw" : "(min-width: 1024px) 42vw, 100vw"
                    }
                    className="object-cover transition-transform duration-slow ease-out-soft motion-safe:group-hover:scale-104"
                  />
                  <div className="absolute inset-0 bg-linear-to-b from-transparent from-45% to-stone-900/60" />
                  <div className="absolute bottom-6 left-6 text-white md:bottom-7 md:left-8">
                    {large && (
                      <p className="font-display text-xl italic md:text-2xl">{c.eyebrow}</p>
                    )}
                    <p
                      className={cn(
                        "font-kr font-semibold",
                        large ? "text-2xl md:text-3xl" : "text-2xl",
                      )}
                    >
                      {c.title}
                    </p>
                    <p className="mt-1 text-sm">
                      {large ? `여행지 ${count}곳` : `${c.label} · ${count}곳`}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function SectionHeader({
  eyebrow,
  title,
  titleId,
  action,
}: {
  eyebrow: string;
  title: string;
  titleId: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="font-display text-xl text-muted-foreground italic md:text-2xl">{eyebrow}</p>
        <h2 id={titleId} className="mt-1.5 font-kr text-2xl font-semibold md:text-3xl">
          {title}
        </h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="shrink-0 text-base font-medium text-primary hover:underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
