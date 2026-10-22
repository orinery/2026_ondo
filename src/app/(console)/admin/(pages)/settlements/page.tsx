import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { SettleButton } from "@/components/settlements/settle-button";
import {
  SettlementItemsTable,
  SettlementStateBadge,
} from "@/components/settlements/settlement-parts";
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
import {
  getSettlementItems,
  getSettlementSummary,
  monthLabel,
  shiftMonth,
} from "@/lib/data/settlements";
import { formatKrw, formatTimestamp } from "@/lib/format";
import { seoulNow } from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "정산" };

/**
 * 관리자: 파트너별 월 정산 (/admin/settlements?month=YYYY-MM-01&partner=…, 기본 = 지난달)
 * 이용월이 끝난 달만 "정산 완료 처리"할 수 있다 (DB admin_settle_month가 다시 확인).
 * 파트너를 고르면 그 달 정산 항목(+ 정산 완료 뒤 환불 조정 전표)을 아래에 보여 준다 — 확정 전에 근거를 확인하도록.
 */
export default async function AdminSettlementsPage({
  searchParams,
}: PageProps<"/admin/settlements">) {
  await requireRole("admin", "/admin/settlements");
  const { today } = seoulNow();
  const current = `${today.slice(0, 7)}-01`;
  const oldest = shiftMonth(current, -12);
  const { month: monthParam, partner: partnerParam } = await searchParams;
  const month =
    typeof monthParam === "string" &&
    /^\d{4}-\d{2}-01$/.test(monthParam) &&
    monthParam >= oldest &&
    monthParam <= current
      ? monthParam
      : shiftMonth(current, -1);

  const rows = await getSettlementSummary(null, month, month, current);
  // 고른 파트너가 그 달 목록에 있을 때만 상세를 불러온다 (주소를 고쳐 넣은 값은 무시)
  const selected =
    typeof partnerParam === "string" ? rows.find((r) => r.partnerId === partnerParam) : undefined;
  const items = selected ? await getSettlementItems(selected.partnerId, month) : [];
  const hrefOf = (m: string, partner?: string) =>
    `/admin/settlements?month=${m}${partner ? `&partner=${partner}` : ""}`;
  const total = (key: "itemCount" | "revenue" | "commission" | "payout") =>
    rows.reduce((n, r) => n + r[key], 0);

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Settlements"
        title="정산"
        description="파트너별 이용월 정산. 파트너를 누르면 항목을 확인할 수 있고, 끝난 달을 정산 완료로 처리하면 숫자가 고정돼요 (모의 — 실제 송금 없음)."
      />
      <nav aria-label="정산 월" className="flex items-center gap-2">
        <MonthLink
          href={hrefOf(shiftMonth(month, -1), selected?.partnerId)}
          disabled={month <= oldest}
          label="이전 달"
          icon="prev"
        />
        <p className="min-w-28 text-center font-kr text-lg font-semibold" aria-live="polite">
          {monthLabel(month)}
        </p>
        <MonthLink
          href={hrefOf(shiftMonth(month, 1), selected?.partnerId)}
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
                <TableRow
                  key={r.partnerId}
                  className={cn(r.partnerId === selected?.partnerId && "bg-muted/60")}
                >
                  <TableCell className="pl-4 font-medium">
                    <Link
                      href={hrefOf(month, r.partnerId)}
                      scroll={false}
                      aria-current={r.partnerId === selected?.partnerId ? "true" : undefined}
                      className="hover:underline"
                    >
                      {r.partnerName}
                    </Link>
                  </TableCell>
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

      {selected && (
        <section aria-labelledby="settlement-detail" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="settlement-detail" className="font-kr text-lg font-semibold">
              {selected.partnerName} · {monthLabel(month)} 정산 내역
            </h2>
            <Link
              href={hrefOf(month)}
              scroll={false}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              닫기
            </Link>
          </div>
          {selected.state === "settled" && (
            <p className="text-sm text-muted-foreground">
              정산 완료된 달이에요. 완료 뒤 환불을 조정한 예약은 이 표에 조정 전 금액으로 보이고,
              차액은 조정한 달의 정산에 &lsquo;정산 후 환불 조정&rsquo;으로 반영돼요.
            </p>
          )}
          <SettlementItemsTable items={items} orderHref={(no) => `/admin/orders/${no}`} />
        </section>
      )}
    </div>
  );
}

function MonthLink({
  href,
  disabled,
  label,
  icon,
}: {
  href: string;
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
    <Link href={href} scroll={false} className={className}>
      <Icon aria-hidden className="size-4" />
      <span className="sr-only">{label}</span>
    </Link>
  );
}
