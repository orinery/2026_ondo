import { auditActionLabel, auditActorLabel } from "@/lib/audit-labels";
import type { TimelineEntry } from "@/lib/data/admin";
import { formatKrw, formatTimestamp } from "@/lib/format";

/**
 * 관리자: 주문 처리 이력 — 누가 · 언제 · 무엇을 했는지 (audit_logs).
 * 항목이 여러 개인 주문은 기록마다 어떤 상품인지 함께 보여 준다.
 */
export function OrderTimeline({
  entries,
  itemTitles,
  headingId = "order-timeline",
}: {
  entries: TimelineEntry[];
  itemTitles: Map<string, string>;
  headingId?: string; // 한 화면에 여러 개(쇼케이스)일 때 제목 id가 겹치지 않게
}) {
  const showItem = itemTitles.size > 1;
  const hasBackfilled = entries.some((e) => e.backfilled);

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card p-5 text-sm">
      <h2 id={headingId} className="mb-4 font-semibold">
        처리 이력
      </h2>
      {entries.length === 0 ? (
        <p className="text-muted-foreground">기록이 없어요.</p>
      ) : (
        <ol className="flex flex-col gap-4 border-l pl-4">
          {entries.map((e) => (
            <li key={e.id} className="relative flex flex-col gap-0.5">
              <span
                aria-hidden
                className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-muted-foreground"
              />
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{auditActionLabel(e.action, e.actorRole)}</span>
                <span className="text-muted-foreground">
                  {auditActorLabel(e.actorRole, { actor: e.actorName, partner: e.partnerName })}
                </span>
              </p>
              <p className="text-muted-foreground tabular-nums">
                <time dateTime={e.at}>{formatTimestamp(e.at, true)}</time>
                {showItem && e.itemId && ` · ${itemTitles.get(e.itemId) ?? "삭제된 항목"}`}
                {(e.refundAmount ?? 0) > 0 && ` · 환불 ${formatKrw(e.refundAmount ?? 0)}`}
              </p>
              {e.reason && <p>사유: {e.reason}</p>}
            </li>
          ))}
        </ol>
      )}
      {hasBackfilled && (
        <p className="mt-4 text-xs text-muted-foreground">
          감사 로그 도입(2026-10-21) 전 기록은 저장된 시각으로 복원해 처리한 계정이 비어 있을 수
          있어요.
        </p>
      )}
    </section>
  );
}
