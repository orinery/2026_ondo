import "server-only";

import type { AuditActorRole } from "@/lib/audit-labels";
import type { CategorySlug, ReportReason, ReportStatus } from "@/lib/constants/taxonomy";
import { categoryLabel } from "@/lib/constants/taxonomy";
import type { DisplayStatus } from "@/lib/order-status";
import { sqlNull } from "@/lib/sql-null";
import { createClient } from "@/lib/supabase/server";
import {
  ADMIN_PAGE_SIZE,
  type AdminOrderFilters,
  type AdminProductFilters,
} from "@/lib/validation/admin-filters";

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

/** 관리자: 상품 목록 (임시 저장 포함) — 판매 중지된 상품을 먼저, 검색·필터 + 페이지 */
export async function getAdminProducts(
  filters: AdminProductFilters,
  page: number,
): Promise<{ rows: AdminProductRow[]; total: number }> {
  const supabase = await createClient();
  let query = supabase.from("products").select(
    `id, slug, title, adult_price, published_at, unavailable_reason, suspended_reason, suspended_at,
       review_count, partners ( name ), cities ( name )`,
    { count: "exact" },
  );
  const search = sanitize(filters.q);
  if (search) query = query.ilike("title", `%${search}%`);
  if (filters.partner) query = query.eq("partner_id", filters.partner);
  if (filters.city) query = query.eq("city_id", filters.city);
  // 상태 우선순위: 판매 중지(관리자) > 임시 저장 > 판매 일시 중단 > 판매 중
  switch (filters.state) {
    case "suspended":
      query = query.not("suspended_reason", "is", null);
      break;
    case "draft":
      query = query.is("suspended_reason", null).is("published_at", null);
      break;
    case "paused":
      query = query
        .is("suspended_reason", null)
        .not("published_at", "is", null)
        .not("unavailable_reason", "is", null);
      break;
    case "on_sale":
      query = query
        .is("suspended_reason", null)
        .not("published_at", "is", null)
        .is("unavailable_reason", null);
      break;
  }
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  const { data, error, count } = await query
    .order("suspended_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + ADMIN_PAGE_SIZE - 1);
  if (error) throw error;
  return {
    total: count ?? 0,
    rows: data.map((p) => ({
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
    })),
  };
}

// 쿼리 문법으로 해석될 수 있는 문자를 지운 뒤 검색한다 (상품 검색과 같은 이유)
const sanitize = (q: string) => q.replace(/[,()%_*\\:"']/g, " ").trim();

export type AdminOrderRow = {
  id: string;
  orderNo: string;
  displayStatus: DisplayStatus;
  partial: boolean; // 끝난 항목과 살아 있는 항목이 섞임 (부분 취소)
  bookerName: string;
  totalAmount: number;
  refundAmount: number | null;
  paidAt: string;
  firstTitle: string;
  partnerNames: string;
  counts: { items: number; pending: number; upcoming: number; used: number; closed: number };
};

/**
 * 관리자: 주문 목록 — 검색·상태·파트너·결제일 필터 + 페이지 (DB 함수 admin_orders).
 * limit을 크게 주면 CSV 내려받기에도 같은 함수를 쓴다 (최대 5,000건).
 */
export async function getAdminOrders(
  filters: AdminOrderFilters,
  { limit, offset }: { limit: number; offset: number },
): Promise<{ rows: AdminOrderRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_orders", {
    p_q: filters.q,
    p_status: filters.status,
    p_partner: sqlNull(filters.partner),
    p_from: sqlNull(filters.from),
    p_to: sqlNull(filters.to),
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return {
    total: data[0]?.total_count ?? 0,
    rows: data.map((o) => ({
      id: o.id,
      orderNo: o.order_no,
      displayStatus: o.display_status as DisplayStatus,
      partial: o.partial,
      bookerName: o.booker_name,
      totalAmount: o.total_amount,
      refundAmount: o.refund_amount,
      paidAt: o.paid_at,
      firstTitle: o.first_title,
      partnerNames: o.partner_names,
      counts: {
        items: o.item_count,
        pending: o.pending_count,
        upcoming: o.upcoming_count,
        used: o.used_count,
        closed: o.closed_count,
      },
    })),
  };
}

export type FilterOption = { id: string; name: string };

/** 관리자 목록 필터용 파트너·도시 목록 */
export async function getFilterOptions(): Promise<{
  partners: FilterOption[];
  cities: FilterOption[];
}> {
  const supabase = await createClient();
  const [partners, cities] = await Promise.all([
    supabase.from("partners").select("id, name").order("name"),
    supabase.from("cities").select("id, name").order("position"),
  ]);
  if (partners.error) throw partners.error;
  if (cities.error) throw cities.error;
  return { partners: partners.data, cities: cities.data };
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

export type TimelineEntry = {
  id: string;
  at: string;
  action: string;
  actorRole: AuditActorRole;
  actorName: string | null;
  partnerName: string | null; // 항목 기록이면 그 항목의 판매 파트너
  itemId: string | null; // 주문 항목 기록이면 항목 id (주문 전체 기록은 null)
  reasonCode: string | null;
  reason: string | null;
  refundAmount: number | null;
  backfilled: boolean; // 감사 로그 도입 전 기록을 타임스탬프로 복원한 것
};

/** 관리자: 주문 처리 이력 (결제 → 확정 → 사용·취소 …) — 오래된 순 */
export async function getOrderTimeline(orderId: string): Promise<TimelineEntry[]> {
  const supabase = await createClient();
  const [logs, items] = await Promise.all([
    supabase
      .from("audit_logs")
      .select(
        `id, created_at, action, actor_role, entity, entity_id, reason_code, reason, after,
         actor:profiles!audit_logs_actor_id_profiles_id_fk ( display_name )`,
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase.from("order_items").select("id, partners ( name )").eq("order_id", orderId),
  ]);
  if (logs.error) throw logs.error;
  if (items.error) throw items.error;

  const partnerOf = new Map(items.data.map((i) => [i.id, i.partners.name]));
  return logs.data.map((l) => {
    const after = (l.after ?? {}) as { refund_amount?: number | null; backfilled?: boolean };
    const itemId = l.entity === "order_item" ? l.entity_id : null;
    return {
      id: l.id,
      at: l.created_at,
      action: l.action,
      actorRole: l.actor_role as AuditActorRole,
      actorName: l.actor?.display_name ?? null,
      partnerName: itemId ? (partnerOf.get(itemId) ?? null) : null,
      itemId,
      reasonCode: l.reason_code,
      reason: l.reason,
      refundAmount: after.refund_amount ?? null,
      backfilled: after.backfilled === true,
    };
  });
}

export type OrderMemo = { id: string; body: string; at: string; authorName: string | null };

/** 관리자: 주문 CS 메모 — 남긴 순서대로 */
export async function getOrderMemos(orderId: string): Promise<OrderMemo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_memos")
    .select(
      "id, body, created_at, author:profiles!order_memos_created_by_profiles_id_fk ( display_name )",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    body: m.body,
    at: m.created_at,
    authorName: m.author?.display_name ?? null,
  }));
}

/** 관리자: 이용월이 이미 정산 완료된 항목 id — 환불 조정 시 조정 전표 안내용 */
export async function getSettledItemIds(orderId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("order_items")
    .select("id, partner_id, use_date")
    .eq("order_id", orderId);
  if (error) throw error;
  if (items.length === 0) return new Set();
  const { data: settled, error: settledError } = await supabase
    .from("settlements")
    .select("partner_id, month")
    .in("partner_id", [...new Set(items.map((i) => i.partner_id))]);
  if (settledError) throw settledError;
  const keys = new Set(settled.map((s) => `${s.partner_id}:${s.month}`));
  return new Set(
    items.filter((i) => keys.has(`${i.partner_id}:${i.use_date.slice(0, 7)}-01`)).map((i) => i.id),
  );
}
