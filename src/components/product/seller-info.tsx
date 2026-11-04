import { ChevronDownIcon } from "lucide-react";

import type { Seller } from "@/lib/data/products";
import { cn } from "@/lib/utils";

/**
 * 판매자 정보 (Q3) — 통신판매중개자는 판매자의 신원 정보를 청약 전에 확인할 수 있게 해야 한다.
 * 판매자 이름과 중개 고지는 항상 보이고, 나머지 항목은 펼쳐서 본다 (상세 본문이 길어지지 않게).
 */
export function SellerInfo({ seller, className }: { seller: Seller; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-sm">
        이 상품은 <span className="font-semibold">{seller.name}</span>이(가) 판매해요. 여운은
        통신판매중개자로서 거래 당사자가 아니며, 상품 정보와 예약 이행의 책임은 판매자에게 있어요.
      </p>
      <details className="group rounded-md border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          판매자 정보 자세히 보기
          <ChevronDownIcon
            aria-hidden
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t px-4 py-3 text-sm">
          <Row label="상호">{seller.name}</Row>
          <Row label="대표자">{seller.representative}</Row>
          <Row label="사업자등록번호">{seller.businessRegNo}</Row>
          <Row label="여행업 등록번호">{seller.tourismLicenseNo ?? "해당 없음"}</Row>
          <Row label="주소">{seller.businessAddress}</Row>
          <Row label="연락처">{seller.phone}</Row>
          <Row label="이메일">{seller.email}</Row>
        </dl>
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          포트폴리오 예시 정보예요 — 실제 사업자가 아니에요.
        </p>
      </details>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all tabular-nums">{children}</dd>
    </>
  );
}
