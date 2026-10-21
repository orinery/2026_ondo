import type { PartnerProductRow } from "@/lib/data/partner-center";
import { cn } from "@/lib/utils";

const LABEL: Record<PartnerProductRow["state"], string> = {
  draft: "임시 저장",
  on_sale: "판매 중",
  paused: "판매 일시 중단",
  suspended: "판매 중지(관리자)",
};

// 빨강·주황 글자는 테두리 스타일 — 옅은 배경은 다크 모드 대비가 부족하다 (8단계 점검)
const STYLE: Record<PartnerProductRow["state"], string> = {
  draft: "bg-muted text-muted-foreground",
  on_sale: "bg-accent text-accent-foreground",
  paused: "border border-warning/50 text-warning",
  suspended: "border border-destructive/50 text-destructive",
};

/** 파트너 상품 판매 상태 배지 */
export function ProductStateBadge({
  state,
  className,
}: {
  state: PartnerProductRow["state"];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold",
        STYLE[state],
        className,
      )}
    >
      {LABEL[state]}
    </span>
  );
}
