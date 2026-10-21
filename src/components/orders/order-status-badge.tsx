import {
  itemStatusLabel,
  statusLabel,
  type DisplayStatus,
  type ItemDisplayStatus,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";

// 빨강·주황 글자는 옅은 배경 대신 테두리로 — 옅은 배경은 다크 모드 대비가 부족하다 (8단계 점검)
const PENDING = "border border-warning/50 text-warning";
const ACTIVE = "bg-accent text-accent-foreground";
const DONE = "bg-muted text-muted-foreground";
const ENDED = "border border-destructive/50 text-destructive";

const STYLES: Record<DisplayStatus, string> = {
  pending: PENDING,
  upcoming: ACTIVE,
  used: DONE,
  cancelled: ENDED,
};

const ITEM_STYLES: Record<ItemDisplayStatus, string> = {
  pending: PENDING,
  processing: PENDING,
  confirmed: ACTIVE,
  used: DONE,
  rejected: ENDED,
  cancelled: ENDED,
  expired: ENDED,
};

const BASE = "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold";

/** 주문 상태 배지 — 확정 대기 / 이용 예정 / 이용 완료 / 취소 */
export function OrderStatusBadge({
  status,
  className,
}: {
  status: DisplayStatus;
  className?: string;
}) {
  return <span className={cn(BASE, STYLES[status], className)}>{statusLabel(status)}</span>;
}

/** 주문 항목(예약 상품 하나) 상태 배지 — 확정 대기 / 예약 확정 / 이용 완료 / 거절 / 취소 / 기한 초과 */
export function ItemStatusBadge({
  status,
  className,
}: {
  status: ItemDisplayStatus;
  className?: string;
}) {
  return (
    <span className={cn(BASE, ITEM_STYLES[status], className)}>{itemStatusLabel(status)}</span>
  );
}
