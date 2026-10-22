import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ProductSuspensionAction } from "@/components/admin/product-suspension-action";
import { ConsolePageHeader } from "@/components/console/console-shell";
import { FilterChips, ListPagination, NativeSelect } from "@/components/console/list-controls";
import { ProductStateBadge } from "@/components/partner/product-state-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import type { SuspensionKind } from "@/lib/constants/taxonomy";
import { getAdminProducts, getFilterOptions } from "@/lib/data/admin";
import { formatKrw } from "@/lib/format";
import {
  ADMIN_PAGE_SIZE,
  PRODUCT_STATE_FILTERS,
  parseAdminProductParams,
  productSearchParams,
} from "@/lib/validation/admin-filters";

export const metadata: Metadata = { title: "상품" };

const SUSPENSION_KIND_LABEL: Record<SuspensionKind, string> = {
  info_fix: "정보 수정 필요",
  unsafe: "운영 불가·위험",
  partner_suspended: "파트너 이용 정지",
};

/**
 * 관리자: 상품 목록 (/admin/products?q=&partner=&city=&state=&page=) — 임시 저장 포함, 판매 중지/재개.
 * 필터는 GET 폼이라 URL에 남는다. 판매 중지된 상품이 먼저 보인다.
 */
export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireRole("admin", "/admin/products");
  const { filters, page } = parseAdminProductParams(await searchParams);
  const [{ rows, total }, { partners, cities }] = await Promise.all([
    getAdminProducts(filters, page),
    getFilterOptions(),
  ]);
  const href = (query: string) => (query ? `/admin/products?${query}` : "/admin/products");
  const filtered = Boolean(filters.q || filters.partner || filters.city);

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Products"
        title="상품"
        description="문제가 있는 상품은 판매를 중지할 수 있어요 (사유는 파트너에게 보여요)."
      />

      <FilterChips
        label="상품 상태"
        items={PRODUCT_STATE_FILTERS.map((s) => ({
          href: href(productSearchParams({ ...filters, state: s.value })),
          label: s.label,
          active: filters.state === s.value,
        }))}
      />

      <form
        role="search"
        aria-label="상품 찾기"
        className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
      >
        {filters.state !== "all" && <input type="hidden" name="state" value={filters.state} />}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-q" className="text-sm font-medium">
            상품명
          </label>
          <Input id="product-q" name="q" defaultValue={filters.q} className="h-11" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-partner" className="text-sm font-medium">
            파트너
          </label>
          <NativeSelect id="product-partner" name="partner" defaultValue={filters.partner ?? ""}>
            <option value="">전체 파트너</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-city" className="text-sm font-medium">
            도시
          </label>
          <NativeSelect id="product-city" name="city" defaultValue={filters.city ?? ""}>
            <option value="">전체 도시</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="h-11 rounded-md px-4">
            <SearchIcon aria-hidden className="size-4" />
            찾기
          </Button>
          {filtered && (
            <Button asChild variant="ghost" className="h-11 rounded-md px-3">
              <Link href={href(productSearchParams({ state: filters.state }))}>초기화</Link>
            </Button>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          조건에 맞는 상품이 없어요.
        </p>
      ) : (
        <>
          <div className="rounded-xl border bg-card">
            <Table className="min-w-[52rem]" scrollLabel="상품 목록 표">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">상품</TableHead>
                  <TableHead>파트너</TableHead>
                  <TableHead className="text-right">가격</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="pr-4 text-right">
                    <span className="sr-only">관리</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const state = p.suspendedReason
                    ? "suspended"
                    : !p.published
                      ? "draft"
                      : p.unavailableReason
                        ? "paused"
                        : "on_sale";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        {p.published ? (
                          <Link
                            href={`/products/${p.slug}`}
                            className="font-medium hover:underline"
                          >
                            {p.title}
                          </Link>
                        ) : (
                          <span className="font-medium">{p.title}</span>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {p.cityName} · 리뷰 {p.reviewCount}
                        </span>
                      </TableCell>
                      <TableCell>{p.partnerName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatKrw(p.adultPrice)}
                      </TableCell>
                      <TableCell>
                        <ProductStateBadge state={state} />
                        {(p.suspendedReason ?? p.unavailableReason) && (
                          <span className="mt-1 block max-w-56 text-xs text-muted-foreground">
                            {p.suspendedKind && `${SUSPENSION_KIND_LABEL[p.suspendedKind]} · `}
                            {p.suspendedReason ?? p.unavailableReason}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <ProductSuspensionAction
                          productId={p.id}
                          title={p.title}
                          suspended={p.suspendedReason !== null}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ListPagination
            label="상품 목록 페이지"
            page={page}
            pageSize={ADMIN_PAGE_SIZE}
            total={total}
            hrefOf={(p) => href(productSearchParams(filters, p))}
          />
        </>
      )}
    </div>
  );
}
