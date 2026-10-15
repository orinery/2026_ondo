import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AddToTripDialog } from "@/components/destination/add-to-trip-dialog";
import { DestinationMap } from "@/components/destination/destination-map";
import { Gallery } from "@/components/destination/gallery";
import { LikeButton } from "@/components/destination/like-button";
import { ReviewDialog } from "@/components/destination/review-dialog";
import { ReviewSection } from "@/components/destination/review-section";
import { ShareButton } from "@/components/destination/share-button";
import { ItineraryTimeline } from "@/components/itinerary/itinerary-timeline";
import { seasonLabel, themeLabel } from "@/lib/constants/taxonomy";
import { getCurrentUser } from "@/lib/auth";
import { getDestinationBySlug, getReviews, type DestinationDetail } from "@/lib/data/destinations";
import { getLikedIds } from "@/lib/data/likes";
import { getMyTrips } from "@/lib/data/trips";
import type { ItineraryDay } from "@/types/itinerary";

export async function generateMetadata({
  params,
}: PageProps<"/destinations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  // getDestinationBySlug는 cache()로 감싸져 있어 아래 페이지와 같은 요청에서 한 번만 조회된다
  const d = await getDestinationBySlug(slug);
  if (!d) return { title: "여행지를 찾을 수 없어요" };
  return {
    title: `${d.name} ${d.nameEn}`,
    description: d.summary,
    openGraph: {
      title: `${d.name} · 여운`,
      description: d.summary,
      images: [{ url: d.imageUrl, alt: d.imageAlt }],
    },
  };
}

/** 여행지 상세 (명세 4.3) */
export default async function DestinationDetailPage({ params }: PageProps<"/destinations/[slug]">) {
  const { slug } = await params;
  const destination = await getDestinationBySlug(slug);
  if (!destination) notFound();

  const [{ items: reviews, distribution }, likedIds, user, trips] = await Promise.all([
    getReviews(destination.id),
    getLikedIds(),
    getCurrentUser(),
    // "일정에 담기"에서 고를 내 여행 목록 (비로그인이면 빈 배열)
    getMyTrips(),
  ]);
  // 여행지당 리뷰 1개(사용자 확정) → 이미 쓴 리뷰가 있으면 다이얼로그가 수정 모드가 된다
  const myReview = user ? (reviews.find((r) => r.userId === user.id) ?? null) : null;
  const liked = likedIds.includes(destination.id);
  const days = toItineraryDays(destination);

  return (
    // 1023 이하: 하단 고정 CTA(+360 하단 탭)에 내용이 가려지지 않게 여백
    <div className="container pt-8 pb-28 md:pt-10 lg:pb-section">
      {/* ── 타이틀: 한글명 + 영문 세리프 · 국가/테마/평점 · 찜·공유·일정에 담기 ── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {destination.country} · {themeLabel(destination.theme)} ·{" "}
            <span className="text-foreground">
              <span aria-hidden>★</span>
              <span className="sr-only">평점</span> {destination.rating.toFixed(1)}
            </span>{" "}
            (리뷰 {destination.reviewCount})
          </p>
          <h1 className="mt-1 flex flex-wrap items-baseline gap-x-3 font-kr text-3xl font-semibold md:text-4xl">
            {destination.name}
            <span className="font-display font-normal text-muted-foreground">
              {destination.nameEn}
            </span>
          </h1>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <LikeButton
            destinationId={destination.id}
            destinationName={destination.name}
            initialLiked={liked}
            variant="outline"
          />
          <ShareButton title={`${destination.name} · 여운`} />
          <AddToTripDialog
            destinationId={destination.id}
            destinationName={destination.name}
            slug={destination.slug}
            trips={trips}
            isLoggedIn={Boolean(user)}
          />
        </div>
      </header>

      {/* ── 갤러리: 7+5 bento → 라이트박스 / 767 이하 캐러셀 ── */}
      <div className="mt-6">
        <Gallery images={destination.images} title={destination.name} />
      </div>

      {/* ── 본문 8col + 사이드 4col (1023 이하 단일 컬럼) ── */}
      <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="flex min-w-0 flex-col gap-14 lg:col-span-8">
          <section aria-labelledby="about-title" className="flex flex-col gap-3">
            <h2 id="about-title" className="font-kr text-2xl font-semibold">
              소개
            </h2>
            <p className="text-lg">{destination.summary}</p>
            <p className="text-base text-muted-foreground">{destination.description}</p>
          </section>

          <section aria-labelledby="plan-title" className="flex flex-col gap-4">
            <h2 id="plan-title" className="font-kr text-2xl font-semibold">
              추천 일정
            </h2>
            {days.length === 0 ? (
              <p className="rounded-lg border-[1.5px] border-dashed border-input py-10 text-center text-muted-foreground">
                추천 일정을 준비하고 있어요.
              </p>
            ) : (
              <ItineraryTimeline days={days} readOnly />
            )}
          </section>

          <ReviewSection
            rating={destination.rating}
            reviewCount={destination.reviewCount}
            reviews={reviews}
            distribution={distribution}
            currentUserId={user?.id}
            action={
              <ReviewDialog
                destinationId={destination.id}
                slug={destination.slug}
                destinationName={destination.name}
                userId={user?.id ?? null}
                myReview={
                  myReview
                    ? {
                        id: myReview.id,
                        rating: myReview.rating,
                        content: myReview.content,
                        photoUrl: myReview.photoUrl,
                      }
                    : null
                }
              />
            }
          />
        </div>

        <aside aria-label="여행 정보" className="lg:col-span-4">
          <div className="flex flex-col gap-5 lg:sticky lg:top-24">
            <DestinationMap
              latitude={destination.latitude}
              longitude={destination.longitude}
              label={destination.name}
            />
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-lg border bg-card p-5 text-sm">
              <dt className="text-muted-foreground">추천 시즌</dt>
              <dd>{destination.bestSeasons.map(seasonLabel).join(" · ")}</dd>
              <dt className="text-muted-foreground">비행</dt>
              <dd>{destination.flightInfo ?? "정보 없음"}</dd>
              <dt className="text-muted-foreground">시차</dt>
              <dd>{destination.timeDifference ?? "정보 없음"}</dd>
              <dt className="text-muted-foreground">통화</dt>
              <dd>{destination.currency ?? "정보 없음"}</dd>
            </dl>
          </div>
        </aside>
      </div>

      {/* ── 1023 이하: 하단 고정 CTA (360에서는 하단 탭 위에 놓인다) ── */}
      <div className="fixed inset-x-0 bottom-[calc(--spacing(16)+env(safe-area-inset-bottom))] z-20 border-t bg-background/95 backdrop-blur md:bottom-0 md:pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="container flex items-center gap-2 py-3">
          <LikeButton
            destinationId={destination.id}
            destinationName={destination.name}
            initialLiked={liked}
            variant="outline"
          />
          <ShareButton title={`${destination.name} · 여운`} className="shrink-0" />
          <AddToTripDialog
            destinationId={destination.id}
            destinationName={destination.name}
            slug={destination.slug}
            trips={trips}
            isLoggedIn={Boolean(user)}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}

/** DB의 추천 일정 행 → 타임라인 컴포넌트 형태(Day별 묶음) */
function toItineraryDays(d: DestinationDetail): ItineraryDay[] {
  const byDay = new Map<number, ItineraryDay>();
  d.itinerary.forEach((item, index) => {
    const day = byDay.get(item.dayNumber) ?? {
      id: `day-${item.dayNumber}`,
      label: `Day ${item.dayNumber}`,
      items: [],
    };
    day.items.push({
      id: `${item.dayNumber}-${index}`,
      time: item.time,
      title: item.title,
      note: item.note,
      type: item.type,
      status: "upcoming", // 추천 일정은 진행 상태가 없다
      closedReason: item.caution,
    });
    byDay.set(item.dayNumber, day);
  });
  return [...byDay.values()];
}
