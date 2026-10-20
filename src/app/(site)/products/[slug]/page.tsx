import { CheckIcon, MapPinIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingWidget } from "@/components/product/booking-widget";
import { CancellationPolicyTable } from "@/components/product/cancellation-policy-table";
import { Gallery } from "@/components/product/gallery";
import { LikeButton } from "@/components/product/like-button";
import { LocationMap } from "@/components/product/location-map";
import { ProductCard, ProductGrid } from "@/components/product/product-card";
import { ReviewDialog } from "@/components/product/review-dialog";
import { ReviewSection } from "@/components/product/review-section";
import { ShareButton } from "@/components/product/share-button";
import { ReadonlyTimeline } from "@/components/itinerary/readonly-timeline";
import { getCurrentUser } from "@/lib/auth";
import { cutoffLabel, operatingDaysLabel } from "@/lib/booking";
import { categoryLabel, themeLabel } from "@/lib/constants/taxonomy";
import { getLikedIds } from "@/lib/data/likes";
import {
  canReviewProduct,
  getProductBySlug,
  getRelatedProducts,
  getReviews,
  type ProductDetail,
} from "@/lib/data/products";
import { formatKrw } from "@/lib/format";
import { seoulNow } from "@/lib/trip-dates";
import type { ItineraryDay } from "@/types/itinerary";

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  // getProductBySlug는 cache()로 감싸져 있어 아래 페이지와 같은 요청에서 한 번만 조회된다
  const p = await getProductBySlug(slug);
  if (!p) return { title: "상품을 찾을 수 없어요" };
  return {
    title: p.title,
    description: `${p.summary} · 성인 ${formatKrw(p.adultPrice)}부터`,
    openGraph: {
      title: `${p.title} · 여운`,
      description: p.summary,
      images: [{ url: p.imageUrl, alt: p.imageAlt }],
    },
  };
}

/** 상품 상세 (명세 4.3 상세 구성 + 예약 위젯) */
export default async function ProductDetailPage({
  params,
  searchParams,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const query = await searchParams;
  const initialDate = typeof query.date === "string" ? query.date : null;

  const [{ items: reviews, distribution }, likedIds, user, related] = await Promise.all([
    getReviews(product.id),
    getLikedIds(),
    getCurrentUser(),
    getRelatedProducts(product),
  ]);
  // 상품당 리뷰 1개(사용자 확정) → 이미 쓴 리뷰가 있으면 다이얼로그가 수정 모드가 된다
  const myReview = user ? (reviews.find((r) => r.userId === user.id) ?? null) : null;
  // 새 리뷰는 이용을 마친 구매 고객만 (DB 정책과 같은 판단으로 버튼을 미리 숨긴다)
  const canReview = user && !myReview ? await canReviewProduct(product.id) : false;
  const liked = likedIds.includes(product.id);
  const days = toItineraryDays(product);
  const { today } = seoulNow();

  return (
    // 1023 이하: 하단 고정 예약 바(+360 하단 탭)에 내용이 가려지지 않게 여백
    <div className="container pt-8 pb-28 md:pt-10 lg:pb-section">
      {/* ── 타이틀: 도시 · 종류 · 평점 / 상품명 / 찜·공유 ── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/products?city=${product.city.slug}`}
              className="underline-offset-3 hover:text-foreground hover:underline"
            >
              {product.city.name} <span className="font-display">{product.city.nameEn}</span>
            </Link>{" "}
            · {categoryLabel(product.category)} · {themeLabel(product.theme)} ·{" "}
            {product.reviewCount === 0 ? (
              "아직 리뷰가 없어요"
            ) : (
              <>
                <span className="text-foreground">
                  <span aria-hidden>★</span>
                  <span className="sr-only">평점</span> {product.rating.toFixed(1)}
                </span>{" "}
                (리뷰 {product.reviewCount})
              </>
            )}
          </p>
          <h1 className="mt-1 font-kr text-3xl font-semibold md:text-4xl">{product.title}</h1>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <LikeButton
            productId={product.id}
            productTitle={product.title}
            initialLiked={liked}
            variant="outline"
          />
          <ShareButton title={`${product.title} · 여운`} />
        </div>
      </header>

      {/* ── 갤러리: 7+5 bento → 라이트박스 / 767 이하 캐러셀 ── */}
      <div className="mt-6">
        <Gallery images={product.images} title={product.title} />
      </div>

      {/* ── 본문 8col + 사이드 4col 예약 위젯 (1023 이하 단일 컬럼 + 하단 예약 바) ── */}
      <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="flex min-w-0 flex-col gap-14 lg:col-span-8">
          <section aria-labelledby="about-title" className="flex flex-col gap-4">
            <h2 id="about-title" className="font-kr text-2xl font-semibold">
              상품 소개
            </h2>
            <p className="text-lg">{product.summary}</p>
            <p className="text-base text-muted-foreground">{product.description}</p>
            {product.highlights.length > 0 && (
              <ul className="flex flex-col gap-2" aria-label="상품 포인트">
                {product.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-base">
                    <CheckIcon aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
                    {h}
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border bg-card p-5 text-sm md:grid-cols-4">
              <Fact label="운영">{operatingDaysLabel(product.operatingDays)}</Fact>
              <Fact label="소요 시간">{product.durationText}</Fact>
              <Fact label="시작 시간">{product.startTime ?? "자유"}</Fact>
              <Fact label="예약 마감">{cutoffLabel(product.cutoffDays)}</Fact>
            </dl>
          </section>

          {days.length > 0 && (
            <section aria-labelledby="plan-title" className="flex flex-col gap-4">
              <h2 id="plan-title" className="font-kr text-2xl font-semibold">
                진행 일정
              </h2>
              <ReadonlyTimeline days={days} />
            </section>
          )}

          <section aria-labelledby="includes-title" className="flex flex-col gap-4">
            <h2 id="includes-title" className="font-kr text-2xl font-semibold">
              포함 · 불포함
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <IconList title="포함" items={product.includes} icon="check" />
              <IconList title="불포함" items={product.excludes} icon="x" />
            </div>
          </section>

          {product.usageInfo.length > 0 && (
            <section aria-labelledby="usage-title" className="flex flex-col gap-4">
              <h2 id="usage-title" className="font-kr text-2xl font-semibold">
                이용 안내
              </h2>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-base marker:text-muted-foreground">
                {product.usageInfo.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="place-title" className="flex flex-col gap-4">
            <h2 id="place-title" className="font-kr text-2xl font-semibold">
              {product.category === "tour" ? "만나는 장소" : "이용 장소"}
            </h2>
            <p className="flex items-start gap-2 text-base">
              <MapPinIcon aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
              {product.meetingPoint}
            </p>
            <div className="max-w-xl">
              <LocationMap
                latitude={product.latitude}
                longitude={product.longitude}
                label={product.meetingPoint}
              />
            </div>
          </section>

          <section aria-labelledby="policy-title" className="flex flex-col gap-4">
            <h2 id="policy-title" className="font-kr text-2xl font-semibold">
              취소 규정
            </h2>
            <CancellationPolicyTable
              name={product.cancelPolicy.name}
              summary={product.cancelPolicy.summary}
              tiers={product.cancelPolicy.tiers}
              className="max-w-xl"
            />
          </section>

          <ReviewSection
            rating={product.rating}
            reviewCount={product.reviewCount}
            reviews={reviews}
            distribution={distribution}
            currentUserId={user?.id}
            action={
              <ReviewDialog
                productId={product.id}
                slug={product.slug}
                productTitle={product.title}
                userId={user?.id ?? null}
                canReview={canReview}
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

        <aside aria-label="예약" className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <BookingWidget
              product={{
                id: product.id,
                slug: product.slug,
                title: product.title,
                adultPrice: product.adultPrice,
                childPrice: product.childPrice,
                listAdultPrice: product.listAdultPrice,
                operatingDays: product.operatingDays,
                cutoffDays: product.cutoffDays,
                maxQty: product.maxQty,
                unavailableReason: product.unavailableReason,
                startTime: product.startTime,
                durationText: product.durationText,
              }}
              today={today}
              initialDate={initialDate}
              isLoggedIn={Boolean(user)}
              mobileActions={
                <LikeButton
                  productId={product.id}
                  productTitle={product.title}
                  initialLiked={liked}
                  variant="outline"
                />
              }
            />
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section
          aria-labelledby="related-title"
          className="mt-section-sm flex flex-col gap-8 md:mt-section"
        >
          <h2 id="related-title" className="font-kr text-2xl font-semibold md:text-3xl">
            {product.city.name}에서 함께 보면 좋은 상품
          </h2>
          <ProductGrid>
            {related.map((p) => (
              <ProductCard key={p.id} product={p} initialLiked={likedIds.includes(p.id)} />
            ))}
          </ProductGrid>
        </section>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}

function IconList({ title, items, icon }: { title: string; items: string[]; icon: "check" | "x" }) {
  const Icon = icon === "check" ? CheckIcon : XIcon;
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="text-base font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">없음</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Icon
                aria-hidden
                className={
                  icon === "check"
                    ? "mt-0.5 size-4 shrink-0 text-primary"
                    : "mt-0.5 size-4 shrink-0 text-muted-foreground"
                }
              />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** DB의 진행 일정 행 → 타임라인 컴포넌트 형태 (하루 코스 → Day 1개) */
function toItineraryDays(p: ProductDetail): ItineraryDay[] {
  if (p.itinerary.length === 0) return [];
  return [
    {
      id: "course",
      label: "진행 일정",
      items: p.itinerary.map((item, index) => ({
        id: `course-${index}`,
        time: item.time,
        title: item.title,
        note: item.note,
        type: item.type,
        status: "upcoming", // 상품 일정은 진행 상태가 없다
        closedReason: item.caution,
      })),
    },
  ];
}
