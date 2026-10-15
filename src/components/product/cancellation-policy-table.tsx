import { cn } from "@/lib/utils";

export type PolicyTier = { daysBefore: number; refundRate: number };

type CancellationPolicyTableProps = {
  name: string; // "일반 취소"
  summary: string;
  tiers: PolicyTier[]; // daysBefore 내림차순
  className?: string;
};

/** 구간 설명: [7,100] → "이용 7일 전까지" / [0,0] → "결제 후" */
function tierLabel(tier: PolicyTier) {
  return tier.daysBefore === 0 ? "결제 후" : `이용 ${tier.daysBefore}일 전까지`;
}

/**
 * 취소 규정 표 — 상세·주문서·예약 상세가 같이 쓴다.
 * 환불액은 DB 함수 refund_quote가 같은 구간으로 계산한다 (남은 일수 이하 구간 중 가장 큰 것).
 */
export function CancellationPolicyTable({
  name,
  summary,
  tiers,
  className,
}: CancellationPolicyTableProps) {
  // 마지막 구간 이후~이용 전날은 환불 0% — 그런 기간이 있을 때만 마지막 줄로 보여 준다
  // (마지막 구간이 "1일 전까지"면 그 뒤는 당일이라 취소 자체가 안 되므로 줄이 필요 없다)
  const last = tiers.at(-1);
  const showNoRefundRow = last !== undefined && last.refundRate > 0 && last.daysBefore > 1;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-sm">
        <span className="font-semibold">{name}</span>
        <span className="text-muted-foreground"> · {summary}</span>
      </p>
      <table className="w-full overflow-hidden rounded-md border text-sm">
        <caption className="sr-only">{name} 취소 규정</caption>
        <thead className="bg-muted text-left">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">
              취소 시점
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              환불
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {tiers.map((t) => (
            <tr key={t.daysBefore}>
              <td className="px-4 py-2.5">{tierLabel(t)}</td>
              <td className="px-4 py-2.5 text-right font-medium tabular-nums">{t.refundRate}%</td>
            </tr>
          ))}
          {showNoRefundRow && (
            <tr>
              <td className="px-4 py-2.5">그 이후 ~ 이용 전날</td>
              <td className="px-4 py-2.5 text-right font-medium tabular-nums">0%</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">
        이용일 당일과 이후에는 취소할 수 없어요. 환불액은 원 단위에서 내림해요.
      </p>
    </div>
  );
}
