import { CheckCircle2Icon, PackageIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { ProductStateBadge } from "@/components/partner/product-state-badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { getPartnerProducts } from "@/lib/data/partner-center";
import { formatKrw } from "@/lib/format";

export const metadata: Metadata = { title: "상품" };

/** 파트너: 내 상품 목록 (/partner/products) — 판매 상태 · 회차 수 · 수정·재고 관리로 이동 */
export default async function PartnerProductsPage({
  searchParams,
}: PageProps<"/partner/products">) {
  const user = await requireRole("partner", "/partner/products");
  const products = user.partner ? await getPartnerProducts(user.partner.id) : [];
  const { saved } = await searchParams;
  const savedTitle =
    typeof saved === "string" ? products.find((p) => p.id === saved)?.title : undefined;

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Products"
        title="상품"
        description="상품을 등록하고, 회차별 정원·날짜별 재고를 관리해요."
        actions={
          <Button asChild className="h-11 self-start rounded-md px-5 font-semibold">
            <Link href="/partner/products/new">
              <PlusIcon aria-hidden className="size-4" />새 상품
            </Link>
          </Button>
        }
      />

      {savedTitle && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-3 text-sm text-accent-foreground"
        >
          <CheckCircle2Icon aria-hidden className="size-4" />
          &lsquo;{savedTitle}&rsquo;을(를) 저장했어요.
        </p>
      )}

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
          <PackageIcon aria-hidden className="size-8 text-muted-foreground" />
          <p className="font-semibold">아직 등록한 상품이 없어요</p>
          <p className="text-sm text-muted-foreground">첫 상품을 등록하고 판매를 시작해 보세요.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {products.map((p) => (
            <li key={p.id} className="flex gap-4 rounded-xl border bg-card p-4">
              <span className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
                <Image src={p.imageUrl} alt="" fill sizes="80px" className="object-cover" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ProductStateBadge state={p.state} />
                  <span className="text-xs text-muted-foreground">
                    {p.cityName} · {p.confirmationMode === "manual" ? "파트너 확정" : "즉시 확정"}
                  </span>
                </div>
                <p className="truncate font-kr font-semibold">{p.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatKrw(p.adultPrice)} · 회차 {p.slotCount}개 · 리뷰 {p.reviewCount}
                </p>
                {p.stateReason && (
                  <p className="text-xs text-muted-foreground">사유: {p.stateReason}</p>
                )}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
                  <Link
                    href={`/partner/products/${p.id}/edit`}
                    className="text-primary hover:underline"
                  >
                    수정<span className="sr-only"> ({p.title})</span>
                  </Link>
                  <Link
                    href={`/partner/products/${p.id}/inventory`}
                    className="text-primary hover:underline"
                  >
                    재고 관리<span className="sr-only"> ({p.title})</span>
                  </Link>
                  {p.state !== "draft" && (
                    <Link href={`/products/${p.slug}`} className="text-primary hover:underline">
                      상품 페이지<span className="sr-only"> ({p.title})</span>
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
