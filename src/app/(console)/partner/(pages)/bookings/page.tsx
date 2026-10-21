import type { Metadata } from "next";

import { ConsolePageHeader } from "@/components/console/console-shell";
import { UrlTabs } from "@/components/console/url-tabs";
import { BookingList } from "@/components/partner/booking-list";
import { requireRole } from "@/lib/auth";
import { addDays } from "@/lib/booking";
import { expirePendingItems } from "@/lib/data/orders";
import { getPartnerBookings } from "@/lib/data/partner-center";
import { seoulNow } from "@/lib/trip-dates";

export const metadata: Metadata = { title: "예약" };

const TABS = [
  { value: "pending", label: "확정 대기" },
  { value: "upcoming", label: "이용 예정" },
  { value: "past", label: "지난 예약" },
  { value: "closed", label: "취소·거절" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const isTab = (v: unknown): v is Tab => TABS.some((t) => t.value === v);

/**
 * 파트너: 예약 (/partner/bookings?tab=pending|upcoming|past|closed)
 * 이용일 기준 지난 90일 ~ 앞으로 180일. 화면을 열 때 기한 지난 확정 대기를 먼저 정리한다(pg_cron 보완).
 */
export default async function PartnerBookingsPage({
  searchParams,
}: PageProps<"/partner/bookings">) {
  await requireRole("partner", "/partner/bookings");
  const { tab: tabParam } = await searchParams;
  const tab: Tab = isTab(tabParam) ? tabParam : "pending";
  const { today } = seoulNow();

  await expirePendingItems();
  const all = await getPartnerBookings(addDays(today, -90), addDays(today, 180), today);
  const closed = (s: string) => s === "rejected" || s === "cancelled" || s === "expired";
  const lists: Record<Tab, typeof all> = {
    pending: all.filter((b) => b.displayStatus === "pending" || b.displayStatus === "processing"),
    upcoming: all.filter((b) => b.displayStatus === "confirmed"),
    // 지난 예약은 최근 것부터
    past: all.filter((b) => b.displayStatus === "used").reverse(),
    closed: all.filter((b) => closed(b.status)).reverse(),
  };
  const empty: Record<Tab, string> = {
    pending: "확정을 기다리는 예약이 없어요",
    upcoming: "이용 예정인 예약이 없어요",
    past: "지난 90일 동안 이용한 예약이 없어요",
    closed: "취소·거절된 예약이 없어요",
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <ConsolePageHeader
        eyebrow="Bookings"
        title="예약"
        description="파트너 확정 상품은 결제 후 48시간 안에(이용일 전까지) 확정하거나 거절해 주세요. 지나면 자동 취소·전액 환불돼요."
      />
      <UrlTabs
        label="예약 상태"
        current={tab}
        tabs={TABS.map((t) => ({
          ...t,
          href: `/partner/bookings?tab=${t.value}`,
          count: lists[t.value].length,
        }))}
      />
      <BookingList bookings={lists[tab]} emptyText={empty[tab]} />
    </div>
  );
}
