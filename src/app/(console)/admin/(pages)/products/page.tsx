import type { Metadata } from "next";
import Link from "next/link";

import { ProductSuspensionAction } from "@/components/admin/product-suspension-action";
import { ConsolePageHeader } from "@/components/console/console-shell";
import { ProductStateBadge } from "@/components/partner/product-state-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { getAdminProducts } from "@/lib/data/admin";
import { formatKrw } from "@/lib/format";

export const metadata: Metadata = { title: "상품" };

/** 관리자: 전체 상품 (/admin/products) — 임시 저장 포함, 판매 중지/재개 */
export default async function AdminProductsPage() {
  await requireRole("admin", "/admin/products");
  const products = await getAdminProducts();

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Products"
        title="상품"
        description={`전체 ${products.length}개 · 문제가 있는 상품은 판매를 중지할 수 있어요 (사유는 파트너에게 보여요).`}
      />
      <div className="rounded-xl border bg-card">
        <Table className="min-w-[52rem]">
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
            {products.map((p) => {
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
                      <Link href={`/products/${p.slug}`} className="font-medium hover:underline">
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
    </div>
  );
}
