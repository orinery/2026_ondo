import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { requireRole } from "@/lib/auth";
import { expirePendingItems } from "@/lib/data/orders";
import { getPartnerSummary } from "@/lib/data/partner-center";
import { getMyPartner } from "@/lib/data/partners";
import { formatKrw, formatTimestamp } from "@/lib/format";
import { seoulNow } from "@/lib/trip-dates";

export const metadata: Metadata = { title: "홈" };

/**
 * 파트너 센터 홈 (/partner) — 확정 대기 · 오늘 이용 · 이번 달 매출 요약과 바로가기.
 * 화면을 열 때 기한 지난 확정 대기를 먼저 정리한다 (pg_cron 보완).
 */
export default async function PartnerHomePage() {
  const user = await requireRole("partner", "/partner");
  if (!user.partner) notFound();
  const { today } = seoulNow();

  await expirePendingItems();
  const [partner, summary] = await Promise.all([
    getMyPartner(user.partner.id),
    getPartnerSummary(user.partner.id, today),
  ]);
  // 이용 정지·미연결은 레이아웃이 안내한다. 여기서 없으면 RLS로 읽지 못한 것
  if (!partner) notFound();

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Partner Center"
        title={partner.name}
        description={`${formatTimestamp(partner.createdAt)}부터 여운 파트너 · 수수료 ${partner.commissionRate}%`}
      />
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat
          label="확정 대기"
          value={`${summary.pendingCount}건`}
          note={
            summary.nearestDeadline
              ? `가장 빠른 기한 ${formatTimestamp(summary.nearestDeadline, true)}`
              : "처리할 예약이 없어요"
          }
          href="/partner/bookings?tab=pending"
          linkLabel="확정하러 가기"
          urgent={summary.pendingCount > 0}
        />
        <Stat
          label="오늘 이용"
          value={`${summary.todayBookings}건 · ${summary.todayPeople}명`}
          note="현장에서 바우처를 사용 처리해 주세요"
          href="/partner/vouchers"
          linkLabel="바우처 사용 처리"
        />
        <Stat
          label="이번 달 매출 (이용일 기준)"
          value={formatKrw(summary.monthRevenue)}
          note={`등록한 상품 ${partner.productCount}개`}
          href="/partner/products"
          linkLabel="상품 관리"
        />
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  href,
  linkLabel,
  urgent = false,
}: {
  label: string;
  value: string;
  note: string;
  href: string;
  linkLabel: string;
  urgent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className={urgent ? "text-2xl font-semibold text-warning" : "text-2xl font-semibold"}>
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{note}</span>
        <Link href={href} className="mt-2 text-sm font-semibold text-primary hover:underline">
          {linkLabel} →
        </Link>
      </dd>
    </div>
  );
}
