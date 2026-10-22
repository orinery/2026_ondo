import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SettlementItem, SettlementRow, SettlementState } from "@/lib/data/settlements";
import { monthLabel } from "@/lib/data/settlements";
import { formatKrw, formatTimestamp, formatUseDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<SettlementState, string> = {
  open: "집계 중",
  pending: "정산 예정",
  settled: "정산 완료",
};
const STATE_STYLE: Record<SettlementState, string> = {
  open: "bg-muted text-muted-foreground",
  pending: "border border-warning/50 text-warning",
  settled: "bg-accent text-accent-foreground",
};

/** 정산 상태 배지 — 집계 중(이번 달) / 정산 예정(지난달, 미처리) / 정산 완료 */
export function SettlementStateBadge({ state }: { state: SettlementState }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold",
        STATE_STYLE[state],
      )}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

/** 파트너: 월별 정산 카드 목록 — 누르면 그 달 항목 상세 */
export function SettlementMonthList({
  rows,
  selected,
  hrefOf,
}: {
  rows: SettlementRow[];
  selected: string;
  hrefOf: (month: string) => string;
}) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <li key={r.month}>
          <Link
            href={hrefOf(r.month)}
            scroll={false}
            aria-current={r.month === selected ? "page" : undefined}
            className={cn(
              "flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors duration-fast hover:bg-muted",
              r.month === selected && "border-primary ring-2 ring-primary/30",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-kr font-semibold">{monthLabel(r.month)}</span>
              <SettlementStateBadge state={r.state} />
            </span>
            <span className="text-2xl font-semibold tabular-nums">{formatKrw(r.payout)}</span>
            <span className="text-sm text-muted-foreground">
              매출 {formatKrw(r.revenue)} · 수수료 {formatKrw(r.commission)} · {r.itemCount}건
            </span>
            {r.settledAt && (
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(r.settledAt)} 정산 완료
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

const ITEM_STATUS: Record<string, string> = {
  used: "이용 완료",
  confirmed: "이용 완료(확정)",
  cancelled: "취소 · 일부 환불",
  adjustment: "정산 후 환불 조정",
};

/**
 * 정산 상세 — 그 달 정산 대상 항목 + 조정 전표 (767 이하에서는 표가 가로로 스크롤).
 * 조정 전표: 이미 정산 완료된 달의 예약에 환불을 더 해 준 금액이 이 달에 음수로 반영된 행.
 * orderHref를 주면 주문번호가 주문 상세 링크가 된다 (관리자).
 */
export function SettlementItemsTable({
  items,
  orderHref,
}: {
  items: SettlementItem[];
  orderHref?: (orderNo: string) => string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        이 달에 정산할 이용 내역이 없어요.
      </p>
    );
  }
  const sum = (key: "subtotal" | "refund" | "revenue" | "commission") =>
    items.reduce((n, i) => n + i[key], 0);
  const adjustments = items.filter((i) => i.status === "adjustment").length;
  return (
    <div className="rounded-xl border bg-card">
      <Table className="min-w-[44rem]" scrollLabel="정산 내역 표">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">이용일 · 상품</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="text-right">결제</TableHead>
            <TableHead className="text-right">환불</TableHead>
            <TableHead className="text-right">매출</TableHead>
            <TableHead className="pr-4 text-right">수수료</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i, index) => {
            const adjustment = i.status === "adjustment";
            return (
              // 같은 항목에 조정 전표가 여러 번 붙을 수 있어 순번을 함께 쓴다
              <TableRow key={`${i.status}-${i.itemId}-${index}`}>
                <TableCell className="pl-4">
                  <span className="block font-medium">{i.productTitle}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {adjustment ? `${formatUseDate(i.useDate)} 이용분` : formatUseDate(i.useDate)} ·{" "}
                    {orderHref ? (
                      <Link href={orderHref(i.orderNo)} className="hover:underline">
                        {i.orderNo}
                      </Link>
                    ) : (
                      i.orderNo
                    )}
                  </span>
                </TableCell>
                <TableCell className={adjustment ? "text-warning" : undefined}>
                  {ITEM_STATUS[i.status] ?? i.status}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {adjustment ? "-" : formatKrw(i.subtotal)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {i.refund > 0 ? formatKrw(i.refund) : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatKrw(i.revenue)}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {formatKrw(i.commission)}
                  <span className="block text-xs text-muted-foreground">{i.commissionRate}%</span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="pl-4 font-semibold" colSpan={2}>
              합계 {items.length - adjustments}건
              {adjustments > 0 && (
                <span className="font-normal text-muted-foreground"> · 조정 {adjustments}건</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatKrw(sum("subtotal"))}</TableCell>
            <TableCell className="text-right tabular-nums">{formatKrw(sum("refund"))}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatKrw(sum("revenue"))}
            </TableCell>
            <TableCell className="pr-4 text-right font-semibold tabular-nums">
              {formatKrw(sum("commission"))}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
