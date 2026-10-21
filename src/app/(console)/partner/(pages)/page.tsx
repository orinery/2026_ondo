import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { requireRole } from "@/lib/auth";
import { getMyPartner } from "@/lib/data/partners";
import { formatTimestamp } from "@/lib/format";

export const metadata: Metadata = { title: "홈" };

/**
 * 파트너 센터 홈 (/partner) — 지금은 파트너 정보 요약만.
 * 상품·재고·예약(S4), 정산(S5) 메뉴가 생기면 오늘 예약·확정 대기 요약으로 바뀐다.
 */
export default async function PartnerHomePage() {
  const user = await requireRole("partner", "/partner");
  const partner = user.partner ? await getMyPartner(user.partner.id) : null;
  // 이용 정지·미연결은 레이아웃이 안내한다. 여기서 없으면 RLS로 읽지 못한 것
  if (!partner) notFound();

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Partner Center"
        title={partner.name}
        description={`${formatTimestamp(partner.createdAt)}부터 여운 파트너로 활동하고 있어요.`}
      />
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="등록한 상품" value={`${partner.productCount}개`} />
        <Stat label="플랫폼 수수료" value={`${partner.commissionRate}%`} />
        <Stat label="상태" value="활동 중" />
      </dl>
      <p className="text-sm text-muted-foreground">
        상품·재고 관리와 예약 확정, 정산 메뉴는 곧 열려요.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
