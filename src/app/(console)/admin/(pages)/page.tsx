import type { Metadata } from "next";
import Link from "next/link";

import { BreakdownChart, DailyChart } from "@/components/admin/dashboard-charts";
import { ConsolePageHeader } from "@/components/console/console-shell";
import { UrlTabs } from "@/components/console/url-tabs";
import { requireRole } from "@/lib/auth";
import { addDays } from "@/lib/booking";
import { getAdminKpis, getBreakdown, getDailyStats } from "@/lib/data/admin";
import { formatKrw } from "@/lib/format";
import { seoulNow } from "@/lib/trip-dates";

export const metadata: Metadata = { title: "대시보드" };

const PERIODS = [
  { value: "7", label: "7일" },
  { value: "30", label: "30일" },
  { value: "90", label: "90일" },
] as const;
type Period = (typeof PERIODS)[number]["value"];
const isPeriod = (v: unknown): v is Period => PERIODS.some((p) => p.value === v);

/**
 * 관리자 대시보드 (/admin?days=7|30|90) — 결제일(한국 날짜) 기준.
 * 지표·차트 숫자는 관리자 전용 DB 함수가 계산한다. 차트는 스크린리더용 표도 함께 그린다.
 */
export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  await requireRole("admin", "/admin");
  const { days: daysParam } = await searchParams;
  const period: Period = isPeriod(daysParam) ? daysParam : "30";
  const { today } = seoulNow();
  const from = addDays(today, -(Number(period) - 1));

  const [kpis, daily, byCity, byCategory] = await Promise.all([
    getAdminKpis(from, today),
    getDailyStats(from, today),
    getBreakdown(from, today, "city"),
    getBreakdown(from, today, "category"),
  ]);
  const net = kpis.gross - kpis.refunds;
  const cancelRate = kpis.items === 0 ? 0 : Math.round((kpis.closedItems / kpis.items) * 1000) / 10;

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Dashboard"
        title="대시보드"
        description={`최근 ${period}일 (결제일 기준) · 모의 결제 데이터`}
      />
      <UrlTabs
        label="기간"
        current={period}
        tabs={PERIODS.map((p) => ({ ...p, href: `/admin?days=${p.value}` }))}
      />

      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="주문" value={`${kpis.orders}건`} note={`예약 상품 ${kpis.items}개`} />
        <Kpi label="결제액" value={formatKrw(kpis.gross)} note={`환불 후 ${formatKrw(net)}`} />
        <Kpi
          label="환불액"
          value={formatKrw(kpis.refunds)}
          note={`취소·거절·만료 ${kpis.closedItems}개`}
        />
        <Kpi label="취소율" value={`${cancelRate}%`} note="예약 상품 중 취소·거절·만료 비율" />
      </dl>

      {(kpis.openReports > 0 || kpis.pendingApplications > 0 || kpis.pendingItems > 0) && (
        <ul aria-label="처리할 일" className="flex flex-wrap gap-2 text-sm">
          {kpis.pendingApplications > 0 && (
            <TodoLink href="/admin/partners">
              파트너 신청 {kpis.pendingApplications}건 검토
            </TodoLink>
          )}
          {kpis.openReports > 0 && (
            <TodoLink href="/admin/reports">리뷰 신고 {kpis.openReports}건 처리</TodoLink>
          )}
          {kpis.pendingItems > 0 && (
            <TodoLink href="/admin/orders?status=pending">
              파트너 확정 대기 {kpis.pendingItems}건
            </TodoLink>
          )}
        </ul>
      )}

      <section
        aria-labelledby="daily-title"
        className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-6"
      >
        <h2 id="daily-title" className="font-kr text-lg font-semibold">
          일별 결제·환불
        </h2>
        <DailyChart data={daily} title={`최근 ${period}일 일별 결제·환불`} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section
          aria-labelledby="city-title"
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-6"
        >
          <h2 id="city-title" className="font-kr text-lg font-semibold">
            도시별 매출
          </h2>
          <BreakdownChart data={byCity} title="도시별 매출" />
        </section>
        <section
          aria-labelledby="category-title"
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-6"
        >
          <h2 id="category-title" className="font-kr text-lg font-semibold">
            종류별 매출
          </h2>
          <BreakdownChart data={byCategory} title="종류별 매출" />
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-sm text-muted-foreground">{note}</span>
      </dd>
    </div>
  );
}

function TodoLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="inline-flex h-10 items-center rounded-full border border-warning/50 bg-card px-4 font-medium text-warning hover:bg-muted"
      >
        {children} →
      </Link>
    </li>
  );
}
