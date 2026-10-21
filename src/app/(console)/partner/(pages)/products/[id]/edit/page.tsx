import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { ProductForm } from "@/components/partner/product-form";
import { requireRole } from "@/lib/auth";
import { getPartnerProductForm, getProductFormChoices } from "@/lib/data/partner-center";

export const metadata: Metadata = { title: "상품 수정" };

/** 파트너: 상품 수정 (/partner/products/[id]/edit) — 내 상품이 아니면 404 */
export default async function EditProductPage({
  params,
}: PageProps<"/partner/products/[id]/edit">) {
  const { id } = await params;
  const user = await requireRole("partner", `/partner/products/${id}/edit`);
  if (!z.uuid().safeParse(id).success || !user.partner) notFound();

  const [product, { cities, policies }] = await Promise.all([
    getPartnerProductForm(user.partner.id, id),
    getProductFormChoices(),
  ]);
  if (!product) notFound();
  const { id: productId, suspendedReason, ...initial } = product;

  return (
    <div className="flex flex-col gap-6 px-4 pt-8 md:px-8 md:pt-10">
      <ConsolePageHeader eyebrow="Edit Product" title={product.title} description="상품 수정" />
      <ProductForm
        productId={productId}
        partnerId={user.partner.id}
        initial={initial}
        cities={cities.map((c) => ({ value: c.id, label: c.name }))}
        policies={policies.map((p) => ({ value: p.code, label: `${p.name} — ${p.summary}` }))}
        suspendedReason={suspendedReason}
      />
    </div>
  );
}
