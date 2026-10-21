import { CalendarXIcon } from "lucide-react";

import { ItemStatusBadge } from "@/components/orders/order-status-badge";
import type { PartnerBooking } from "@/lib/data/partner-center";
import { formatKrw, formatTimestamp, formatUseDate } from "@/lib/format";

import { BookingActions } from "./booking-actions";

/**
 * 파트너 예약 목록 — 이용일별로 묶은 카드 (표보다 360에서 읽기 쉽다).
 * 확정 대기는 처리 기한과 확정·거절 버튼, 확정은 바우처 코드, 거절은 사유를 보여준다.
 */
export function BookingList({
  bookings,
  emptyText,
}: {
  bookings: PartnerBooking[];
  emptyText: string;
}) {
  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
        <CalendarXIcon aria-hidden className="size-8 text-muted-foreground" />
        <p className="font-semibold">{emptyText}</p>
      </div>
    );
  }

  const days = [...new Set(bookings.map((b) => b.useDate))];
  return (
    <div className="flex flex-col gap-6">
      {days.map((day) => (
        <section key={day} aria-labelledby={`day-${day}`} className="flex flex-col gap-3">
          <h2 id={`day-${day}`} className="font-kr text-base font-semibold">
            {formatUseDate(day)}
          </h2>
          <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {bookings
              .filter((b) => b.useDate === day)
              .map((b) => (
                <li key={b.itemId} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ItemStatusBadge status={b.displayStatus} />
                    <span className="text-xs text-muted-foreground tabular-nums">{b.orderNo}</span>
                  </div>
                  <div>
                    <p className="font-kr font-semibold">{b.productTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.startTime ?? "시간 자유"} · 성인 {b.adultQty}
                      {b.childQty > 0 && ` · 아동 ${b.childQty}`}
                      {b.options && ` · ${b.options}`}
                    </p>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">예약자</dt>
                    <dd>{b.bookerName}</dd>
                    <dt className="text-muted-foreground">연락처</dt>
                    <dd className="tabular-nums">{b.bookerPhone}</dd>
                    <dt className="text-muted-foreground">이메일</dt>
                    <dd className="break-all">{b.bookerEmail}</dd>
                    <dt className="text-muted-foreground">금액</dt>
                    <dd className="font-semibold">
                      {formatKrw(b.subtotal)}
                      {(b.refundAmount ?? 0) > 0 && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          (환불 {formatKrw(b.refundAmount ?? 0)})
                        </span>
                      )}
                    </dd>
                    {b.voucherCode && (
                      <>
                        <dt className="text-muted-foreground">바우처</dt>
                        <dd className="tracking-wider tabular-nums">{b.voucherCode}</dd>
                      </>
                    )}
                  </dl>
                  {b.displayStatus === "pending" && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                      <p className="text-sm text-warning">
                        {b.confirmDeadline &&
                          `${formatTimestamp(b.confirmDeadline, true)}까지 처리`}
                      </p>
                      <BookingActions itemId={b.itemId} title={b.productTitle} />
                    </div>
                  )}
                  {b.status === "rejected" && b.rejectReason && (
                    <p className="text-sm text-muted-foreground">거절 사유: {b.rejectReason}</p>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
