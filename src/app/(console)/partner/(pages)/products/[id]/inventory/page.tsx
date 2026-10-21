import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { InventoryManager } from "@/components/partner/inventory-manager";
import { requireRole } from "@/lib/auth";
import { getPartnerInventory } from "@/lib/data/partner-center";
import { seoulNow } from "@/lib/trip-dates";

export const metadata: Metadata = { title: "재고 관리" };

/** 파트너: 상품 재고 관리 (/partner/products/[id]/inventory) — 내 상품이 아니면 404 */
export default async function InventoryPage({
  params,
}: PageProps<"/partner/products/[id]/inventory">) {
  const { id } = await params;
  const user = await requireRole("partner", `/partner/products/${id}/inventory`);
  if (!z.uuid().safeParse(id).success || !user.partner) notFound();

  const { today } = seoulNow();
  const data = await getPartnerInventory(user.partner.id, id, today);
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <Link
        href="/partner/products"
        className="inline-flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon aria-hidden className="size-4" />
        상품 목록
      </Link>
      <ConsolePageHeader
        eyebrow="Inventory"
        title={data.product.title}
        description="날짜·회차별 정원과 가격을 바꾸거나 판매를 마감해요. 덮어쓰지 않은 날짜는 회차 기본값을 따라요."
      />
      <InventoryManager
        product={{
          adultPrice: data.product.adultPrice,
          childPrice: data.product.childPrice,
          operatingDays: data.product.operatingDays,
        }}
        slots={data.slots}
        inventory={data.inventory}
        today={today}
      />
    </div>
  );
}
