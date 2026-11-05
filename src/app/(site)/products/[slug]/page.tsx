import { CheckIcon, MapPinIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { TrackEvent } from "@/components/analytics/track-event";
import { BookingWidget } from "@/components/product/booking-widget";
import { CancellationPolicyTable } from "@/components/product/cancellation-policy-table";
import { Gallery } from "@/components/product/gallery";
import { LikeButton } from "@/components/product/like-button";
import { LocationMap } from "@/components/product/location-map";
import { ProductCard, ProductGrid } from "@/components/product/product-card";
import { ReviewSection } from "@/components/product/review-section";
import { ViewerReviewAction } from "@/components/product/review-viewer";
import { ViewerBookingWidget } from "@/components/product/viewer-booking-widget";
import { SellerInfo } from "@/components/product/seller-info";
import { ShareButton } from "@/components/product/share-button";
import { ReadonlyTimeline } from "@/components/itinerary/readonly-timeline";
import { cutoffLabel, operatingDaysLabel } from "@/lib/booking";
import { categoryLabel, themeLabel } from "@/lib/constants/taxonomy";
import {
  getProductBySlug,
  getInventory,
  getPublishedSlugs,
  getRelatedProducts,
  getReviews,
  getSellers,
  type ProductDetail,
} from "@/lib/data/products";
import { formatKrw } from "@/lib/format";
import { productJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { seoulNow } from "@/lib/trip-dates";
import type { ItineraryDay } from "@/types/itinerary";

/**
 * 상세는 미리 만들어 엣지 캐시에서 내려준다 (S2 속도 개선) — 쿠키·쿼리를 읽지 않는다.
 * - 빌드 때 공개 상품을 모두 만들고, 새로 공개된 상품은 처음 열릴 때 만든다
 * - 60초마다 다시 만든다(잔여석·가격·오늘 날짜) + 리뷰·주문·파트너 수정은 revalidatePath로 바로 갱신
 * - 찜·로그인·리뷰 권한·로그인 복귀 선택(?resume=)은 브라우저가 채운다 (ViewerProvider·ViewerBookingWidget)
 * 잔여석이 잠깐 어긋나도 담기·결제는 DB가 다시 확인한다.
 */
export const revalidate = 60;

export async function generateStaticParams() {
  return (await getPublishedSlugs()).map((slug) => ({ slug }));
}

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
    // ?date=·로그인 복귀(?resume=) 같은 쿼리 주소가 같은 상품의 다른 페이지로 색인되지 않게
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: {
      title: `${p.title} · 여운`,
      description: p.summary,
      images: [{ url: p.imageUrl, alt: p.imageAlt }],
    },
  };
}

/** 상품 상세 (명세 4.3 상세 구성 + 예약 위젯) */
export default async function ProductDetailPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const { today } = seoulNow();
  const [{ items: reviews, distribution }, related, inventory, sellers] = await Promise.all([
    getReviews(product.id),
    getRelatedProducts(product),
    // 날짜별 잔여석·가격 (예약 위젯 달력·회차 선택용)
    getInventory(
      product.slots.map((sl) => sl.id),
      today,
      { public: true },
    ),
    getSellers([product.id]),
  ]);
  const seller = sellers.get(product.id) ?? null;
  const days = toItineraryDays(product);
  const slotTimes = product.slots.flatMap((sl) => (sl.startTime ? [sl.startTime] : []));

  // 예약 위젯 — 캐시된 HTML에는 쿼리 없는 기본 위젯, 브라우저에서 쿼리·로그인 여부를 반영해 다시 그린다
  const widget = {
    product: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      adultPrice: product.adultPrice,
      childPrice: product.childPrice,
      childAgeLabel: product.childAgeLabel,
      cancelTiers: product.cancelPolicy.tiers,
      listAdultPrice: product.listAdultPrice,
      operatingDays: product.operatingDays,
      cutoffDays: product.cutoffDays,
      maxQty: product.maxQty,
      unavailableReason: product.unavailableReason,
      durationText: product.durationText,
      confirmationMode: product.confirmationMode,
      slots: product.slots,
      options: product.options,
      inventory,
    },
    today,
    mobileActions: (
      <LikeButton productId={product.id} productTitle={product.title} variant="outline" />
    ),
  };

  return (
    // 1023 이하: 하단 고정 예약 바(+360 하단 탭)에 내용이 가려지지 않게 여백
    <div className="container pt-8 pb-28 md:pt-10 lg:pb-section">
      <TrackEvent name="view_item" productId={product.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd(product, seller)) }}
      />
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
          <LikeButton productId={product.id} productTitle={product.title} variant="outline" />
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
              <Fact label="시작 시간">{slotTimes.length > 0 ? slotTimes.join(" · ") : "자유"}</Fact>
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

          {seller && (
            <section aria-labelledby="seller-title" className="flex flex-col gap-4">
              <h2 id="seller-title" className="font-kr text-2xl font-semibold">
                판매자 정보
              </h2>
              <SellerInfo seller={seller} className="max-w-xl" />
            </section>
          )}

          <ReviewSection
            rating={product.rating}
            reviewCount={product.reviewCount}
            reviews={reviews}
            distribution={distribution}
            action={
              <ViewerReviewAction
                productId={product.id}
                slug={product.slug}
                productTitle={product.title}
              />
            }
          />
        </div>

        <aside aria-label="예약" className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <Suspense
              fallback={<BookingWidget {...widget} initialDate={null} isLoggedIn={false} />}
            >
              <ViewerBookingWidget {...widget} />
            </Suspense>
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
              <ProductCard key={p.id} product={p} />
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
