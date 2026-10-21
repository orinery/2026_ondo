import { FlagIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ReportActions } from "@/components/admin/report-actions";
import { ConsolePageHeader } from "@/components/console/console-shell";
import { UrlTabs } from "@/components/console/url-tabs";
import { requireRole } from "@/lib/auth";
import { reportReasonLabel } from "@/lib/constants/taxonomy";
import { getReports } from "@/lib/data/admin";
import { formatTimestamp } from "@/lib/format";

export const metadata: Metadata = { title: "리뷰 신고" };

const TABS = [
  { value: "pending", label: "처리 대기" },
  { value: "done", label: "처리됨" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const isTab = (v: unknown): v is Tab => TABS.some((t) => t.value === v);

/** 관리자: 리뷰 신고 (/admin/reports?tab=pending|done) — 기각하거나 리뷰를 숨긴다 */
export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireRole("admin", "/admin/reports");
  const { tab: tabParam } = await searchParams;
  const tab: Tab = isTab(tabParam) ? tabParam : "pending";
  const reports = await getReports(tab);

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Reports"
        title="리뷰 신고"
        description="숨긴 리뷰는 작성자와 관리자에게만 보이고 평점에서 빠져요. 잘못 숨겼다면 처리됨 탭에서 해제할 수 있어요."
      />
      <UrlTabs
        label="신고 상태"
        current={tab}
        tabs={TABS.map((t) => ({ ...t, href: `/admin/reports?tab=${t.value}` }))}
      />

      {reports.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
          <FlagIcon aria-hidden className="size-8 text-muted-foreground" />
          <p className="font-semibold">
            {tab === "pending" ? "처리할 신고가 없어요" : "처리한 신고가 없어요"}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full border border-warning/50 px-2.5 py-0.5 text-xs font-semibold text-warning">
                  {reportReasonLabel(r.reason)}
                </span>
                <span className="text-xs text-muted-foreground">
                  신고 {r.reporterName} · {formatTimestamp(r.createdAt, true)}
                </span>
              </div>
              {r.detail && <p className="text-sm">&ldquo;{r.detail}&rdquo;</p>}
              {r.review ? (
                <blockquote className="flex flex-col gap-1 rounded-md bg-muted p-3 text-sm">
                  <span className="text-xs text-muted-foreground">
                    <Link
                      href={`/products/${r.review.productSlug}`}
                      className="font-medium hover:underline"
                    >
                      {r.review.productTitle}
                    </Link>{" "}
                    · {r.review.authorName} · ★{r.review.rating}
                    {r.review.hidden && " · 숨김 처리됨"}
                  </span>
                  <span className="whitespace-pre-line">{r.review.content}</span>
                </blockquote>
              ) : (
                <p className="text-sm text-muted-foreground">삭제된 리뷰예요.</p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {r.status === "pending"
                    ? "처리 대기"
                    : `${r.status === "actioned" ? "숨김 처리" : "기각"}${r.handledAt ? ` · ${formatTimestamp(r.handledAt, true)}` : ""}`}
                </span>
                {r.review && (
                  <ReportActions
                    reportId={r.id}
                    reviewId={r.review.id}
                    pending={r.status === "pending"}
                    hidden={r.review.hidden}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
