import Image from "next/image";
import Link from "next/link";

import { formatKrw, formatUseDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type OrderLine = {
  id: string;
  slug: string;
  title: string;
  cityName: string;
  imageUrl: string;
  useDate: string;
  adultQty: number;
  childQty: number;
  subtotal: number;
  note?: React.ReactNode; // 항목 아래 추가 정보 (예: 환불액, 예약 불가 사유)
};

/** 주문 상품 목록 — 주문서·주문 완료·예약 상세가 같이 쓴다 */
export function OrderItemList({ lines, className }: { lines: OrderLine[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col divide-y rounded-lg border bg-card", className)}>
      {lines.map((line) => (
        <li key={line.id} className="flex gap-3 p-4 md:gap-4">
          <span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted md:size-20">
            <Image src={line.imageUrl} alt="" fill sizes="80px" className="object-cover" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">{line.cityName}</p>
            <p className="font-kr text-base font-semibold">
              <Link href={`/products/${line.slug}`} className="underline-offset-3 hover:underline">
                {line.title}
              </Link>
            </p>
            <p className="text-sm">
              {formatUseDate(line.useDate)} · 성인 {line.adultQty}
              {line.childQty > 0 && ` · 아동 ${line.childQty}`}
            </p>
            {line.note}
          </div>
          <p className="shrink-0 text-base font-semibold">{formatKrw(line.subtotal)}</p>
        </li>
      ))}
    </ul>
  );
}
