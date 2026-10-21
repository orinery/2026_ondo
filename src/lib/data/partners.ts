import "server-only";

import type { ApplicationStatus, PartnerStatus } from "@/lib/constants/taxonomy";
import { createClient } from "@/lib/supabase/server";

/**
 * 파트너·파트너 신청 조회 (Data Access Layer)
 * RLS: 신청서·파트너는 본인 것 + 관리자만 보인다. 관리자 화면 함수도 RLS가 그대로 걸러 주므로
 * 관리자가 아닌 사용자가 호출하면 본인 것만(대개 0건) 돌아온다.
 */

export type PartnerApplication = {
  id: string;
  businessName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  intro: string;
  status: ApplicationStatus;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  applicantName: string;
};

export type PartnerRow = {
  id: string;
  name: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  status: PartnerStatus;
  commissionRate: number;
  productCount: number;
  hasOwner: boolean; // 로그인 계정이 연결됐는지 (직영·시드 데모 파트너는 없음)
  createdAt: string;
};

// partner_applications → profiles 외래 키가 두 개(신청자·검토자)라 어느 쪽인지 이름으로 지정한다
const APPLICATION_COLUMNS = `id, business_name, contact_name, contact_phone, contact_email, intro,
  status, reject_reason, created_at, reviewed_at,
  applicant:profiles!partner_applications_user_id_profiles_id_fk ( display_name )`;

type ApplicationRecord = {
  id: string;
  business_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  intro: string;
  status: ApplicationStatus;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  applicant: { display_name: string } | null;
};

const toApplication = (r: ApplicationRecord): PartnerApplication => ({
  id: r.id,
  businessName: r.business_name,
  contactName: r.contact_name,
  contactPhone: r.contact_phone,
  contactEmail: r.contact_email,
  intro: r.intro,
  status: r.status,
  rejectReason: r.reject_reason,
  createdAt: r.created_at,
  reviewedAt: r.reviewed_at,
  applicantName: r.applicant?.display_name ?? "알 수 없음",
});

/** 내 가장 최근 신청서 (파트너 신청 페이지의 진행 상태 표시용) */
export async function getMyLatestApplication(userId: string): Promise<PartnerApplication | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_applications")
    .select(APPLICATION_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<ApplicationRecord, { merge: false }>();
  if (error) throw error;
  return data ? toApplication(data) : null;
}

/** 관리자: 신청서 목록 (검토 중 → 오래된 순으로 먼저 처리, 처리됨 → 최근 순) */
export async function getApplications(status: "pending" | "done"): Promise<PartnerApplication[]> {
  const supabase = await createClient();
  const query = supabase.from("partner_applications").select(APPLICATION_COLUMNS);
  const { data, error } = await (
    status === "pending"
      ? query.eq("status", "pending").order("created_at", { ascending: true })
      : query.neq("status", "pending").order("reviewed_at", { ascending: false }).limit(50)
  ).overrideTypes<ApplicationRecord[], { merge: false }>();
  if (error) throw error;
  return data.map(toApplication);
}

/** 관리자: 파트너 목록 + 상품 수 */
export async function getPartners(): Promise<PartnerRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .select(
      `id, name, contact_name, contact_phone, contact_email, status, commission_rate, owner_user_id,
       created_at, products ( count )`,
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    contactName: p.contact_name,
    contactPhone: p.contact_phone,
    contactEmail: p.contact_email,
    status: p.status,
    commissionRate: Number(p.commission_rate),
    productCount: p.products[0]?.count ?? 0,
    hasOwner: p.owner_user_id !== null,
    createdAt: p.created_at,
  }));
}

/** 파트너 본인: 소속 파트너 정보 + 상품 수 (파트너 센터 첫 화면) */
export async function getMyPartner(partnerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .select("id, name, status, commission_rate, created_at, products ( count )")
    .eq("id", partnerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    status: data.status,
    commissionRate: Number(data.commission_rate),
    productCount: data.products[0]?.count ?? 0,
    createdAt: data.created_at,
  };
}
