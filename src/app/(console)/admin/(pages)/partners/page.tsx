import type { Metadata } from "next";

import { ApplicationList } from "@/components/admin/application-list";
import { PartnerTable } from "@/components/admin/partner-table";
import { ConsolePageHeader } from "@/components/console/console-shell";
import { UrlTabs } from "@/components/console/url-tabs";
import { requireRole } from "@/lib/auth";
import { getApplications, getPartners } from "@/lib/data/partners";

export const metadata: Metadata = { title: "파트너 관리" };

const TABS = [
  { value: "pending", label: "검토 대기" },
  { value: "done", label: "처리된 신청" },
  { value: "partners", label: "파트너" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const isTab = (v: unknown): v is Tab => TABS.some((t) => t.value === v);

/**
 * 관리자: 파트너 신청 검토 · 파트너 목록 (/admin/partners?tab=pending|done|partners)
 * 승인·거절·정지는 DB 함수가 관리자인지 다시 확인한다.
 */
export default async function AdminPartnersPage({ searchParams }: PageProps<"/admin/partners">) {
  await requireRole("admin", "/admin/partners");
  const { tab: tabParam } = await searchParams;
  const tab: Tab = isTab(tabParam) ? tabParam : "pending";

  // 대기 건수는 어느 탭에서든 탭 이름 옆에 보여준다
  const pending = await getApplications("pending");

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Partners"
        title="파트너 관리"
        description="파트너 신청을 검토하고, 활동 중인 파트너를 관리해요."
      />
      <UrlTabs
        label="파트너 관리 메뉴"
        current={tab}
        tabs={TABS.map((t) => ({
          ...t,
          href: `/admin/partners?tab=${t.value}`,
          count: t.value === "pending" ? pending.length : undefined,
        }))}
      />

      {tab === "pending" && <ApplicationList applications={pending} reviewable />}
      {tab === "done" && <ApplicationList applications={await getApplications("done")} />}
      {tab === "partners" && <PartnerTable partners={await getPartners()} />}
    </div>
  );
}
