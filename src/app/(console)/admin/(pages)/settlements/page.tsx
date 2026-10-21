import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { SettleButton } from "@/components/settlements/settle-button";
import { SettlementStateBadge } from "@/components/settlements/settlement-parts";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { getSettlementSummary, monthLabel, shiftMonth } from "@/lib/data/settlements";
import { formatKrw, formatTimestamp } from "@/lib/format";
import { seoulNow } from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "정산" };

/**
 * 관리자: 파트너별 월 정산 (/admin/settlements?month=YYYY-MM-01, 기본 = 지난달)
 * 이용월이 끝난 달만 "정산 완료 처리"할 수 있다 (DB admin_settle_month가 다시 확인).
 */
export default async function AdminSettlementsPage({
  searchParams,
}: PageProps<"/admin/settlements">) {
  await requireRole("admin", "/admin/settlements");
  const { today } = seoulNow();
  const current = `${today.slice(0, 7)}-01`;
  const oldest = shiftMonth(current, -12);
  const { month: monthParam } = await searchParams;
  const month =
    typeof monthParam === "string" &&
    /^\d{4}-\d{2}-01$/.test(monthParam) &&
    monthParam >= oldest &&
    monthParam <= current
      ? monthParam
      : shiftMonth(current, -1);

  const rows = await getSettlementSummary(null, month, month, current);
  const total = (key: "itemCount" | "revenue" | "commission" | "payout") =>
    rows.reduce((n, r) => n + r[key], 0);

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Settlements"
        title="정산"
        description="파트너별 이용월 정산. 끝난 달을 확인하고 정산 완료로 처리하면 숫자가 고정돼요 (모의 — 실제 송금 없음)."
      />
      <nav aria-label="정산 월" className="flex items-center gap-2">
        <MonthLink
          month={shiftMonth(month, -1)}
          disabled={month <= oldest}
          label="이전 달"
          icon="prev"
        />
        <p className="min-w-28 text-center font-kr text-lg font-semibold" aria-live="polite">
          {monthLabel(month)}
        </p>
        <MonthLink
          month={shiftMonth(month, 1)}
          disabled={month >= current}
          label="다음 달"
          icon="next"
        />
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          {monthLabel(month)}에 정산할 이용 내역이 없어요.
        </p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table className="min-w-[46rem]" scrollLabel="파트너별 정산 표">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">파트너</TableHead>
                <TableHead className="text-right">건수</TableHead>
                <TableHead className="text-right">매출</TableHead>
                <TableHead className="text-right">수수료</TableHead>
                <TableHead className="text-right">지급액</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">처리</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.partnerId}>
                  <TableCell className="pl-4 font-medium">{r.partnerName}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.itemCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatKrw(r.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKrw(r.commission)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatKrw(r.payout)}
                  </TableCell>
                  <TableCell>
                    <SettlementStateBadge state={r.state} />
                    {r.settledAt && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatTimestamp(r.settledAt, true)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {r.state === "pending" && (
                      <SettleButton
                        partnerId={r.partnerId}
                        partnerName={r.partnerName}
                        month={r.month}
                        monthText={monthLabel(r.month)}
                        payout={r.payout}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4 font-semibold">합계</TableCell>
                <TableCell className="text-right tabular-nums">{total("itemCount")}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatKrw(total("revenue"))}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatKrw(total("commission"))}
                  <span className="block text-xs font-normal text-muted-foreground">
                    플랫폼 수익
                  </span>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatKrw(total("payout"))}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}

function MonthLink({
  month,
  disabled,
  label,
  icon,
}: {
  month: string;
  disabled: boolean;
  label: string;
  icon: "prev" | "next";
}) {
  const Icon = icon === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  const className = cn(
    "grid size-10 place-items-center rounded-full border",
    disabled ? "pointer-events-none opacity-40" : "hover:bg-muted",
  );
  return disabled ? (
    <span aria-disabled="true" className={className}>
      <Icon aria-hidden className="size-4" />
      <span className="sr-only">{label}</span>
    </span>
  ) : (
    <Link href={`/admin/settlements?month=${month}`} scroll={false} className={className}>
      <Icon aria-hidden className="size-4" />
      <span className="sr-only">{label}</span>
    </Link>
  );
}
