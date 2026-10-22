import { DownloadIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { FilterChips, ListPagination, NativeSelect } from "@/components/console/list-controls";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
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
import { getAdminOrders, getFilterOptions, type AdminOrderRow } from "@/lib/data/admin";
import { formatKrw, formatTimestamp } from "@/lib/format";
import {
  ADMIN_PAGE_SIZE,
  ORDER_STATUS_FILTERS,
  orderSearchParams,
  parseAdminOrderParams,
} from "@/lib/validation/admin-filters";

export const metadata: Metadata = { title: "주문" };

/**
 * 관리자: 주문 목록 (/admin/orders?q=&status=&partner=&from=&to=&page=)
 * 필터는 GET 폼이라 URL에 남아 새로고침·공유해도 같은 결과. 같은 필터로 CSV를 내려받는다(연락처 제외).
 * 취소·환불 조정은 주문 상세에서 한다.
 */
export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireRole("admin", "/admin/orders");
  const { filters, page } = parseAdminOrderParams(await searchParams);
  const [{ rows, total }, { partners }] = await Promise.all([
    getAdminOrders(filters, { limit: ADMIN_PAGE_SIZE, offset: (page - 1) * ADMIN_PAGE_SIZE }),
    getFilterOptions(),
  ]);
  const href = (query: string) => (query ? `/admin/orders?${query}` : "/admin/orders");
  const filtered = Boolean(filters.q || filters.partner || filters.from || filters.to);

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Orders"
        title="주문"
        description="모든 고객의 주문이에요. 운영자 취소·환불 조정·CS 메모는 주문 상세에서 해요."
        actions={
          <Button asChild variant="outline" className="h-11 rounded-md px-4">
            {/* 라우트 핸들러가 파일을 내려주므로 일반 링크로 연다 (클라이언트 이동 X) */}
            <a href={`/admin/orders/export?${orderSearchParams(filters)}`} download>
              <DownloadIcon aria-hidden className="size-4" />
              CSV 내려받기
            </a>
          </Button>
        }
      />

      <FilterChips
        label="주문 상태"
        items={ORDER_STATUS_FILTERS.map((s) => ({
          href: href(orderSearchParams({ ...filters, status: s.value })),
          label: s.label,
          active: filters.status === s.value,
        }))}
      />

      {/* GET 폼: 상태 칩은 숨은 값으로 유지하고, 검색·파트너·기간을 바꾸면 1쪽부터 */}
      <form
        role="search"
        aria-label="주문 찾기"
        className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto_auto_auto] md:items-end"
      >
        {filters.status !== "all" && <input type="hidden" name="status" value={filters.status} />}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="order-q" className="text-sm font-medium">
            주문번호 · 예약자
          </label>
          <Input
            id="order-q"
            name="q"
            defaultValue={filters.q}
            placeholder="YO261020-000035 또는 이름"
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="order-partner" className="text-sm font-medium">
            파트너
          </label>
          <NativeSelect id="order-partner" name="partner" defaultValue={filters.partner ?? ""}>
            <option value="">전체 파트너</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="order-from" className="text-sm font-medium">
            결제일 부터
          </label>
          <Input
            id="order-from"
            name="from"
            type="date"
            defaultValue={filters.from ?? ""}
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="order-to" className="text-sm font-medium">
            까지
          </label>
          <Input
            id="order-to"
            name="to"
            type="date"
            defaultValue={filters.to ?? ""}
            className="h-11"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="h-11 rounded-md px-4">
            <SearchIcon aria-hidden className="size-4" />
            찾기
          </Button>
          {filtered && (
            <Button asChild variant="ghost" className="h-11 rounded-md px-3">
              <Link href={href(orderSearchParams({ status: filters.status }))}>초기화</Link>
            </Button>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          {filtered || filters.status !== "all"
            ? "조건에 맞는 주문이 없어요."
            : "아직 주문이 없어요."}
        </p>
      ) : (
        <>
          <div className="rounded-xl border bg-card">
            <Table className="min-w-[56rem]" scrollLabel="주문 목록 표">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">주문</TableHead>
                  <TableHead>예약자</TableHead>
                  <TableHead>상품 · 파트너</TableHead>
                  <TableHead className="text-right">결제 · 환불</TableHead>
                  <TableHead className="pr-4">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
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
                      <span className="block max-w-64 truncate">
                        {o.firstTitle}
                        {o.counts.items > 1 && (
                          <span className="text-muted-foreground"> 외 {o.counts.items - 1}개</span>
                        )}
                      </span>
                      <span className="block max-w-64 truncate text-xs text-muted-foreground">
                        {o.partnerNames}
                      </span>
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
                      <OrderStatusBadge status={o.displayStatus} />
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {itemSummary(o)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ListPagination
            label="주문 목록 페이지"
            page={page}
            pageSize={ADMIN_PAGE_SIZE}
            total={total}
            hrefOf={(p) => href(orderSearchParams(filters, p))}
          />
        </>
      )}
    </div>
  );
}

/** 항목 상태 요약: "확정 대기 1 · 이용 예정 1 · 취소 1" (항목이 하나뿐이고 배지와 같으면 생략) */
function itemSummary(o: AdminOrderRow) {
  const parts = [
    o.counts.pending > 0 && `확정 대기 ${o.counts.pending}`,
    o.counts.upcoming > 0 && `이용 예정 ${o.counts.upcoming}`,
    o.counts.used > 0 && `이용 완료 ${o.counts.used}`,
    o.counts.closed > 0 && `취소 ${o.counts.closed}`,
  ].filter(Boolean);
  if (o.counts.items === 1 && !o.partial) return null;
  return (o.partial ? "부분 취소 · " : "") + parts.join(" · ");
}
