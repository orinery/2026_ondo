import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { getAdminOrders } from "@/lib/data/admin";
import { formatKrw, formatTimestamp } from "@/lib/format";

export const metadata: Metadata = { title: "주문" };

/** 관리자: 주문 조회 (/admin/orders?q=) — 최근 50건, 주문번호·예약자 이름으로 찾기. 읽기 전용 */
export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireRole("admin", "/admin/orders");
  const { q: qParam } = await searchParams;
  const q = typeof qParam === "string" ? qParam.slice(0, 40) : "";
  const orders = await getAdminOrders(q);

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Orders"
        title="주문"
        description="모든 고객의 주문을 읽기 전용으로 봐요. 취소·확정은 고객·파트너 화면에서 해요."
      />
      {/* GET 폼: 검색어가 URL(?q=)에 남아 새로고침·공유해도 같은 결과 */}
      <form role="search" className="flex max-w-xl gap-2">
        <label htmlFor="order-q" className="sr-only">
          주문번호 또는 예약자 이름
        </label>
        <Input
          id="order-q"
          name="q"
          defaultValue={q}
          placeholder="주문번호 또는 예약자 이름"
          className="h-11"
        />
        <Button type="submit" className="h-11 rounded-md px-4">
          <SearchIcon aria-hidden className="size-4" />
          찾기
        </Button>
      </form>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          {q ? `'${q}'에 맞는 주문이 없어요.` : "아직 주문이 없어요."}
        </p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table className="min-w-[48rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">주문</TableHead>
                <TableHead>예약자</TableHead>
                <TableHead>상품</TableHead>
                <TableHead className="text-right">결제 · 환불</TableHead>
                <TableHead className="pr-4">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="pl-4">
                    <Link
                      href={`/admin/orders/${o.orderNo}`}
                      className="font-medium tabular-nums hover:underline"
                    >
                      {o.orderNo}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {formatTimestamp(o.paidAt, true)}
                    </span>
                  </TableCell>
                  <TableCell>{o.bookerName}</TableCell>
                  <TableCell>
                    <span className="block max-w-64 truncate">{o.firstTitle}</span>
                    {o.itemCount > 1 && (
                      <span className="text-xs text-muted-foreground">외 {o.itemCount - 1}개</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKrw(o.totalAmount)}
                    {(o.refundAmount ?? 0) > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        환불 {formatKrw(o.refundAmount ?? 0)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-sm">
                    {o.status === "cancelled" ? "취소" : "결제 완료"}
                    {o.pendingCount > 0 && (
                      <span className="block text-xs text-warning">확정 대기 {o.pendingCount}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
