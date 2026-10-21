import type { Metadata } from "next";

import { ConsolePageHeader } from "@/components/console/console-shell";
import {
  SettlementItemsTable,
  SettlementMonthList,
} from "@/components/settlements/settlement-parts";
import { requireRole } from "@/lib/auth";
import {
  getSettlementItems,
  getSettlementSummary,
  monthLabel,
  shiftMonth,
  type SettlementRow,
} from "@/lib/data/settlements";
import { seoulNow } from "@/lib/trip-dates";

export const metadata: Metadata = { title: "정산" };

const MONTHS = 6; // 이번 달 포함 최근 6개월

/**
 * 파트너: 정산 (/partner/settlements?month=YYYY-MM-01)
 * 이용월 기준 월별 매출·수수료·지급액. 이번 달은 집계 중, 지난달은 관리자가 정산 완료 처리하기 전까지 정산 예정.
 */
export default async function PartnerSettlementsPage({
  searchParams,
}: PageProps<"/partner/settlements">) {
  const user = await requireRole("partner", "/partner/settlements");
  const { today } = seoulNow();
  const current = `${today.slice(0, 7)}-01`;
  const oldest = shiftMonth(current, -(MONTHS - 1));
  const { month: monthParam } = await searchParams;
  const selected =
    typeof monthParam === "string" &&
    /^\d{4}-\d{2}-01$/.test(monthParam) &&
    monthParam >= oldest &&
    monthParam <= current
      ? monthParam
      : current;

  const [summary, items] = await Promise.all([
    getSettlementSummary(null, oldest, current, current),
    getSettlementItems(null, selected),
  ]);
  // 내역이 없는 달도 0원으로 보여준다 (최근 6개월을 빠짐없이)
  const rows: SettlementRow[] = Array.from({ length: MONTHS }, (_, i) => {
    const month = shiftMonth(current, -i);
    return (
      summary.find((r) => r.month === month) ?? {
        partnerId: user.partner?.id ?? "",
        partnerName: user.partner?.name ?? "",
        month,
        itemCount: 0,
        revenue: 0,
        commission: 0,
        payout: 0,
        settledAt: null,
        state: month >= current ? "open" : "pending",
      }
    );
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Settlements"
        title="정산"
        description="이용일이 속한 달 기준이에요. 매출 = 결제액 − 환불액, 지급액 = 매출 − 수수료(주문 당시 수수료율). 모의 정산이라 실제 송금은 없어요."
      />
      <SettlementMonthList
        rows={rows}
        selected={selected}
        hrefOf={(month) => `/partner/settlements?month=${month}`}
      />
      <section aria-labelledby="settle-items" className="flex flex-col gap-3">
        <h2 id="settle-items" className="font-kr text-lg font-semibold">
          {monthLabel(selected)} 정산 내역
        </h2>
        <SettlementItemsTable items={items} />
      </section>
    </div>
  );
}
