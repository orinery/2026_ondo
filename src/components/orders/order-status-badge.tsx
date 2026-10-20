import { statusLabel, type DisplayStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

const STYLES: Record<DisplayStatus, string> = {
  upcoming: "bg-accent text-accent-foreground",
  used: "bg-muted text-muted-foreground",
  cancelled: "border border-destructive/50 text-destructive",
};

/** 예약 상태 배지 — 이용 예정 / 이용 완료 / 취소 */
export function OrderStatusBadge({
  status,
  className,
}: {
  status: DisplayStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        STYLES[status],
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
