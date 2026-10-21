import "server-only";

import type {
  CategorySlug,
  OrderStatus,
  ReportReason,
  ReportStatus,
} from "@/lib/constants/taxonomy";
import { categoryLabel } from "@/lib/constants/taxonomy";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자 콘솔 조회 (Data Access Layer)
 * - 통계는 관리자 전용 DB 함수(admin_*)가 계산한다 (관리자가 아니면 forbidden)
 * - 목록은 RLS의 관리자 정책(products/orders/review_reports_select_admin)으로 전체를 읽는다
 * 부르는 페이지가 requireRole("admin")으로 먼저 확인한다.
 */

export type AdminKpis = {
  orders: number;
  items: number;
  gross: number;
  refunds: number;
  closedItems: number; // 취소·거절·만료
  pendingItems: number; // 지금 확정 대기 중 (기간과 무관)
  openReports: number;
  pendingApplications: number;
};

export async function getAdminKpis(from: string, to: string): Promise<AdminKpis> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_kpis", { p_from: from, p_to: to });
  if (error) throw error;
  const k = data[0];
  return {
    orders: k?.orders ?? 0,
    items: k?.items ?? 0,
    gross: k?.gross ?? 0,
    refunds: k?.refunds ?? 0,
    closedItems: k?.closed_items ?? 0,
    pendingItems: k?.pending_items ?? 0,
    openReports: k?.open_reports ?? 0,
    pendingApplications: k?.pending_applications ?? 0,
  };
}

export type DailyStat = { day: string; orders: number; gross: number; refunds: number };

export async function getDailyStats(from: string, to: string): Promise<DailyStat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_daily_stats", { p_from: from, p_to: to });
  if (error) throw error;
  return data.map((d) => ({ day: d.day, orders: d.orders, gross: d.gross, refunds: d.refunds }));
}

export type BreakdownRow = { label: string; items: number; revenue: number };

export async function getBreakdown(
  from: string,
  to: string,
  by: "city" | "category",
): Promise<BreakdownRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_breakdown", {
    p_from: from,
    p_to: to,
    p_by: by,
  });
  if (error) throw error;
  return data.map((r) => ({
    // 종류는 DB에 영문 slug(tour·ticket)로 있어 화면용 이름으로 바꾼다
    label: by === "category" ? categoryLabel(r.label as CategorySlug) : r.label,
    items: r.items,
    revenue: r.revenue,
  }));
}

export type AdminProductRow = {
  id: string;
  slug: string;
  title: string;
  partnerName: string;
  cityName: string;
  adultPrice: number;
  published: boolean;
  unavailableReason: string | null;
  suspendedReason: string | null;
  suspendedAt: string | null;
  reviewCount: number;
};

/** 관리자: 전체 상품 (임시 저장 포함) — 판매 중지된 상품을 먼저 */
export async function getAdminProducts(): Promise<AdminProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, slug, title, adult_price, published_at, unavailable_reason, suspended_reason, suspended_at,
       review_count, partners ( name ), cities ( name )`,
    )
    .order("suspended_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    partnerName: p.partners.name,
    cityName: p.cities.name,
    adultPrice: p.adult_price,
    published: p.published_at !== null,
    unavailableReason: p.unavailable_reason,
    suspendedReason: p.suspended_reason,
    suspendedAt: p.suspended_at,
    reviewCount: p.review_count,
  }));
}

export type AdminOrderRow = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  bookerName: string;
  totalAmount: number;
  refundAmount: number | null;
  paidAt: string;
  itemCount: number;
  pendingCount: number;
  firstTitle: string;
};

/** 관리자: 최근 주문 50건 (주문번호·예약자 이름으로 찾기) */
export async function getAdminOrders(q: string): Promise<AdminOrderRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_no, status, booker_name, total_amount, refund_amount, paid_at, order_items ( product_title, status )",
    )
    .order("paid_at", { ascending: false })
    .limit(50);
  // 쿼리 문법으로 해석될 수 있는 문자를 지운 뒤 검색한다 (상품 검색과 같은 이유)
  const search = q.replace(/[,()%_*\\:"']/g, " ").trim();
  if (search) query = query.or(`order_no.ilike.%${search}%,booker_name.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((o) => ({
    id: o.id,
    orderNo: o.order_no,
    status: o.status,
    bookerName: o.booker_name,
    totalAmount: o.total_amount,
    refundAmount: o.refund_amount,
    paidAt: o.paid_at,
    itemCount: o.order_items.length,
    pendingCount: o.order_items.filter((i) => i.status === "pending").length,
    firstTitle: o.order_items[0]?.product_title ?? "",
  }));
}

export type AdminReport = {
  id: string;
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  createdAt: string;
  handledAt: string | null;
  reporterName: string;
  review: {
    id: string;
    rating: number;
    content: string;
    hidden: boolean;
    authorName: string;
    productTitle: string;
    productSlug: string;
  } | null;
};

const REPORT_COLUMNS = `id, reason, detail, status, created_at, handled_at,
  reporter:profiles!review_reports_reporter_id_profiles_id_fk ( display_name ),
  reviews ( id, rating, content, hidden_at, profiles ( display_name ), products ( title, slug ) )`;

/** 관리자: 리뷰 신고 — 대기 중(오래된 순) 또는 처리됨(최근 순) */
export async function getReports(tab: "pending" | "done"): Promise<AdminReport[]> {
  const supabase = await createClient();
  const base = supabase.from("review_reports").select(REPORT_COLUMNS);
  const { data, error } =
    tab === "pending"
      ? await base.eq("status", "pending").order("created_at", { ascending: true })
      : await base.neq("status", "pending").order("handled_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    reason: r.reason,
    detail: r.detail,
    status: r.status,
    createdAt: r.created_at,
    handledAt: r.handled_at,
    reporterName: r.reporter?.display_name ?? "알 수 없음",
    review: r.reviews
      ? {
          id: r.reviews.id,
          rating: r.reviews.rating,
          content: r.reviews.content,
          hidden: r.reviews.hidden_at !== null,
          authorName: r.reviews.profiles?.display_name ?? "여행자",
          productTitle: r.reviews.products.title,
          productSlug: r.reviews.products.slug,
        }
      : null,
  }));
}
