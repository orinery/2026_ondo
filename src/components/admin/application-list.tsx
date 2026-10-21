import { InboxIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { applicationStatusLabel } from "@/lib/constants/taxonomy";
import type { PartnerApplication } from "@/lib/data/partners";
import { formatTimestamp } from "@/lib/format";

import { ApplicationActions } from "./application-actions";

/** 관리자: 파트너 신청서 카드 목록 (검토 대기면 승인·거절 버튼, 처리됨이면 처리 시각) */
export function ApplicationList({
  applications,
  reviewable = false,
}: {
  applications: PartnerApplication[];
  reviewable?: boolean;
}) {
  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
        <InboxIcon aria-hidden className="size-8 text-muted-foreground" />
        <p className="font-semibold">
          {reviewable ? "검토할 신청이 없어요" : "처리한 신청이 없어요"}
        </p>
        <p className="text-sm text-muted-foreground">회원이 파트너 신청을 하면 여기에 나타나요.</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {applications.map((a) => (
        <li key={a.id} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{a.businessName}</p>
              <p className="text-sm text-muted-foreground">
                신청자 {a.applicantName} · {formatTimestamp(a.createdAt, true)}
              </p>
            </div>
            <Badge variant={a.status === "approved" ? "default" : "outline"}>
              {applicationStatusLabel(a.status)}
            </Badge>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">담당자</dt>
            <dd>{a.contactName}</dd>
            <dt className="text-muted-foreground">연락처</dt>
            <dd className="tabular-nums">{a.contactPhone}</dd>
            <dt className="text-muted-foreground">이메일</dt>
            <dd className="break-all">{a.contactEmail}</dd>
          </dl>
          <p className="text-sm whitespace-pre-line">{a.intro}</p>
          {a.status === "rejected" && (
            <p className="rounded-md bg-muted p-3 text-sm">
              <span className="font-medium">거절 사유</span> · {a.rejectReason}
            </p>
          )}
          {reviewable ? (
            <ApplicationActions applicationId={a.id} businessName={a.businessName} />
          ) : (
            a.reviewedAt && (
              <p className="text-xs text-muted-foreground">
                {formatTimestamp(a.reviewedAt, true)} 처리
              </p>
            )
          )}
        </li>
      ))}
    </ul>
  );
}
