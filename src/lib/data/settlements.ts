import "server-only";

import { sqlNull } from "@/lib/sql-null";
import { createClient } from "@/lib/supabase/server";

/**
 * 정산 조회 (Data Access Layer) — 계산은 DB 함수(settlement_summary·settlement_items)가 한다.
 * 파트너가 부르면 DB가 자기 파트너로 고정하고, 관리자는 지정한 파트너(null = 전체)를 본다.
 */

export type SettlementState = "open" | "pending" | "settled"; // 집계 중(이번 달) / 정산 예정 / 정산 완료

export type SettlementRow = {
  partnerId: string;
  partnerName: string;
  month: string; // "YYYY-MM-01"
  itemCount: number;
  revenue: number;
  commission: number;
  payout: number;
  settledAt: string | null;
  state: SettlementState;
};

export type SettlementItem = {
  itemId: string;
  orderNo: string;
  productTitle: string;
  useDate: string;
  status: string;
  subtotal: number;
  refund: number;
  revenue: number;
  commissionRate: number;
  commission: number;
};

/** "YYYY-MM-01"의 n달 뒤 1일 */
export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + n, 1)).toISOString().slice(0, 10);
}

export const monthLabel = (month: string) =>
  `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;

const stateOf = (month: string, currentMonth: string, settledAt: string | null): SettlementState =>
  settledAt ? "settled" : month >= currentMonth ? "open" : "pending";

export async function getSettlementSummary(
  partnerId: string | null,
  fromMonth: string,
  toMonth: string,
  currentMonth: string,
): Promise<SettlementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("settlement_summary", {
    // 파트너 화면은 null을 넘겨도 DB가 본인 파트너로 고정한다
    p_partner: sqlNull(partnerId),
    p_from: fromMonth,
    p_to: toMonth,
  });
  if (error) throw error;
  return data.map((r) => {
    const month = r.month.slice(0, 10);
    return {
      partnerId: r.partner_id,
      partnerName: r.partner_name,
      month,
      itemCount: r.item_count,
      revenue: r.revenue,
      commission: r.commission,
      payout: r.payout,
      settledAt: r.settled_at,
      state: stateOf(month, currentMonth, r.settled_at),
    };
  });
}

export async function getSettlementItems(
  partnerId: string | null,
  month: string,
): Promise<SettlementItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("settlement_items", {
    p_partner: sqlNull(partnerId),
    p_from: month,
    p_to: month,
  });
  if (error) throw error;
  return data.map((i) => ({
    itemId: i.item_id,
    orderNo: i.order_no,
    productTitle: i.product_title,
    useDate: i.use_date,
    status: i.status,
    subtotal: i.subtotal,
    refund: i.refund,
    revenue: i.revenue,
    commissionRate: Number(i.commission_rate),
    commission: i.commission,
  }));
}
