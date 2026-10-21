import Image from "next/image";
import Link from "next/link";

import { formatKrw, formatUseDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type OrderLine = {
  id: string;
  slug: string | null; // null = 지금은 공개되지 않은 상품 (링크·사진 없이 주문 기록만)
  title: string;
  cityName: string;
  imageUrl: string | null;
  badge?: React.ReactNode; // 상품명 옆 상태 배지 (예약 상세)
  useDate: string;
  startTime?: string | null; // 회차 시간 "10:00"
  adultQty: number;
  childQty: number;
  options?: string[]; // 고른 옵션 이름 ("호텔 픽업", "도시락 ×2")
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
            {line.imageUrl && (
              <Image src={line.imageUrl} alt="" fill sizes="80px" className="object-cover" />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {line.badge}
              {line.cityName}
            </p>
            <p className="font-kr text-base font-semibold">
              {line.slug ? (
                <Link
                  href={`/products/${line.slug}`}
                  className="underline-offset-3 hover:underline"
                >
                  {line.title}
                </Link>
              ) : (
                line.title
              )}
            </p>
            <p className="text-sm">
              {formatUseDate(line.useDate)}
              {line.startTime && ` ${line.startTime}`} · 성인 {line.adultQty}
              {line.childQty > 0 && ` · 아동 ${line.childQty}`}
            </p>
            {line.options && line.options.length > 0 && (
              <p className="text-sm text-muted-foreground">옵션: {line.options.join(", ")}</p>
            )}
            {line.note}
          </div>
          <p className="shrink-0 text-base font-semibold">{formatKrw(line.subtotal)}</p>
        </li>
      ))}
    </ul>
  );
}
