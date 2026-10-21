import type { Metadata } from "next";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { ProductForm } from "@/components/partner/product-form";
import { requireRole } from "@/lib/auth";
import { getProductFormChoices } from "@/lib/data/partner-center";

export const metadata: Metadata = { title: "새 상품" };

/** 파트너: 새 상품 등록 (/partner/products/new) — 처음에는 임시 저장으로 만들고 "판매 시작"을 켜면 공개 */
export default async function NewProductPage() {
  const user = await requireRole("partner", "/partner/products/new");
  const { cities, policies } = await getProductFormChoices();

  return (
    <div className="flex flex-col gap-6 px-4 pt-8 md:px-8 md:pt-10">
      <ConsolePageHeader eyebrow="New Product" title="새 상품" />
      <ProductForm
        productId={null}
        partnerId={user.partner?.id ?? ""}
        initial={null}
        cities={cities.map((c) => ({ value: c.id, label: c.name }))}
        policies={policies.map((p) => ({ value: p.code, label: `${p.name} — ${p.summary}` }))}
        suspendedReason={null}
      />
    </div>
  );
}
