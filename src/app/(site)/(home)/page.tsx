import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HeroSearch } from "@/components/home/hero-search";
import { ProductCard } from "@/components/product/product-card";
import { COLLECTIONS, SEASON_EDITS } from "@/lib/constants/season-edits";
import { getLikedIds } from "@/lib/data/likes";
import { getCities, getFeaturedProducts, getThemeTotals } from "@/lib/data/products";
import { englishMonth, seasonOf, seoulYear } from "@/lib/season";
import { seoulNow } from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  // 메인은 레이아웃의 기본 제목("여운 Yeoun")을 그대로 쓴다
  description:
    "떠나기 전의 설렘이 돌아온 뒤의 여운으로. 일본 6개 도시의 투어·액티비티와 입장권을 날짜와 인원만 골라 바로 예약하세요.",
};

/** 메인 (명세 4.1): 히어로 → 인기 상품 → 도시 바로가기 → 테마별 컬렉션 */
export default async function HomePage() {
  const now = new Date();
  const season = seasonOf(now);
  const edit = SEASON_EDITS[season];
  const [featured, themeTotals, likedIds, cities] = await Promise.all([
    getFeaturedProducts(),
    getThemeTotals(),
    getLikedIds(),
    getCities(),
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
          <HeroSearch
            cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
            today={seoulNow(now).today}
          />
        </div>
      </section>

      {/* ── 인기 상품: 추천 순위 상위 8개 (1280 4열×2 · 768 2.5열 스크롤 · 360 1.3열 스냅) ── */}
      <section
        aria-labelledby="featured-title"
        className="container pt-section-sm md:pt-section xl:pt-24"
      >
        <SectionHeader
          eyebrow={`Picked for ${englishMonth(now)}`}
          title="지금 가장 많이 찾는 상품"
          titleId="featured-title"
          action={{ href: "/products", label: "전체 보기 →" }}
        />
        {featured.length === 0 ? (
          <p className="rounded-lg border-[1.5px] border-dashed border-input py-16 text-center text-muted-foreground">
            추천할 상품을 준비하고 있어요.
          </p>
        ) : (
          // 가로 스크롤 영역은 화면 끝까지 닿도록 container 여백만큼 바깥으로 늘린다
          <ul className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-6 overflow-x-auto px-5 pb-2 md:-mx-8 md:scroll-px-8 md:px-8 xl:mx-0 xl:grid xl:grid-cols-4 xl:overflow-visible xl:px-0">
            {featured.map((p, i) => (
              <li key={p.id} className="w-[76%] shrink-0 snap-start md:w-[38%] xl:w-auto">
                <ProductCard
                  product={p}
                  initialLiked={likedIds.includes(p.id)}
                  showReviewCount={false}
                  priority={i < 2}
                  sizes="(min-width: 1280px) 300px, (min-width: 768px) 38vw, 76vw"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 도시 바로가기: 360 2열 · 768 3열 · 1280 6열 (쇼핑몰 전환으로 추가, 기존 토큰으로 구성) ── */}
      <section
        aria-labelledby="cities-title"
        className="container pt-section-sm md:pt-section xl:pt-section-lg"
      >
        <SectionHeader eyebrow="Where to" title="도시별로 찾아보기" titleId="cities-title" />
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/products?city=${c.slug}`}
                className="group relative block aspect-card overflow-hidden rounded-lg bg-muted"
              >
                <Image
                  src={c.imageUrl}
                  alt={c.imageAlt}
                  fill
                  sizes="(min-width: 1280px) 200px, (min-width: 768px) 33vw, 50vw"
                  className="object-cover transition-transform duration-slow ease-out-soft motion-safe:group-hover:scale-104"
                />
                <div className="absolute inset-0 bg-linear-to-b from-transparent from-40% to-stone-900/70" />
                <div className="absolute inset-x-4 bottom-4 text-white">
                  <p className="font-display text-lg italic">{c.nameEn}</p>
                  <p className="font-kr text-xl font-semibold">{c.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs">{c.summary}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
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
                  href={`/products?theme=${c.theme}`}
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
                      {large ? `상품 ${count}개` : `${c.label} · ${count}개`}
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
