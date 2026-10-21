import { ClockIcon, StoreIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PartnerApplyForm } from "@/components/partner/partner-apply-form";
import { requireUser } from "@/lib/auth";
import { getMyLatestApplication } from "@/lib/data/partners";
import { formatTimestamp } from "@/lib/format";

export const metadata: Metadata = {
  title: "파트너 신청",
  description: "여운에서 일본 여행 상품을 판매할 파트너를 모집해요.",
  robots: { index: false, follow: false },
};

/**
 * 파트너 신청 (/partner-apply) — 회원이 신청하면 관리자가 승인/거절한다 (사용자 확정).
 * 상태: 신청 전 → 폼 / 검토 중 → 안내 / 거절 → 사유 + 다시 신청 / 이미 파트너 → 파트너 센터 링크
 */
export default async function PartnerApplyPage() {
  const user = await requireUser("/partner-apply");
  const latest = user.role === "customer" ? await getMyLatestApplication(user.id) : null;

  return (
    <div className="container py-10 md:py-14">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="font-display text-2xl text-muted-foreground italic">Partners</p>
          <h1 className="font-kr text-4xl font-semibold">파트너 신청</h1>
          <p className="text-muted-foreground">
            여운에서 일본 여행 투어·티켓을 판매해 보세요. 신청서를 검토한 뒤 승인되면 파트너
            센터에서 상품을 등록할 수 있어요.
          </p>
        </header>

        {user.role === "partner" ? (
          <StatusCard icon={StoreIcon} title="이미 파트너예요">
            <Link href="/partner" className="font-semibold text-primary hover:underline">
              파트너 센터로 가기 →
            </Link>
          </StatusCard>
        ) : user.role === "admin" ? (
          <StatusCard icon={TriangleAlertIcon} title="관리자 계정은 파트너로 신청할 수 없어요">
            <p>한 계정은 하나의 역할만 가질 수 있어요. 다른 계정으로 신청해 주세요.</p>
          </StatusCard>
        ) : latest?.status === "pending" ? (
          <StatusCard icon={ClockIcon} title="신청서를 검토하고 있어요">
            <p>
              {latest.businessName} · {formatTimestamp(latest.createdAt)} 신청
            </p>
            <p>승인되면 계정 메뉴에 &lsquo;파트너 센터&rsquo;가 나타나요.</p>
          </StatusCard>
        ) : (
          <section aria-labelledby="apply-title" className="flex flex-col gap-5">
            {latest?.status === "rejected" && (
              <div role="status" className="rounded-lg border border-destructive/40 bg-card p-5">
                <p className="font-semibold text-destructive">지난 신청이 승인되지 않았어요</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  사유: {latest.rejectReason ?? "—"}
                  {latest.reviewedAt && ` (${formatTimestamp(latest.reviewedAt)})`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  내용을 보완해 다시 신청할 수 있어요.
                </p>
              </div>
            )}
            <h2 id="apply-title" className="font-kr text-xl font-semibold">
              신청서
            </h2>
            <PartnerApplyForm defaults={{ name: user.displayName, email: user.email ?? "" }} />
          </section>
        )}
      </div>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className="flex gap-4 rounded-xl border bg-card p-6">
      <Icon aria-hidden className="mt-0.5 size-6 shrink-0 text-primary" />
      <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {children}
      </div>
    </div>
  );
}
