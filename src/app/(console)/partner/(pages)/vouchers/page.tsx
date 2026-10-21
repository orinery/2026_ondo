import type { Metadata } from "next";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { VoucherForm } from "@/components/partner/voucher-form";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "바우처 사용 처리" };

/** 파트너: 바우처 사용 처리 (/partner/vouchers) — 이용일 당일부터, 확정된 내 상품 예약만 */
export default async function VouchersPage() {
  await requireRole("partner", "/partner/vouchers");
  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Vouchers"
        title="바우처 사용 처리"
        description="현장에서 고객의 바우처 코드를 입력하면 '이용 완료'가 되고, 고객은 리뷰를 쓸 수 있어요."
      />
      <VoucherForm />
    </div>
  );
}
