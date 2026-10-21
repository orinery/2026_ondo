import type { PartnerApplication, PartnerRow } from "@/lib/data/partners";

/** /dev/components 쇼케이스용 파트너 신청서·파트너 목업 */
const PENDING: PartnerApplication = {
  id: "00000000-0000-4000-8000-0000000000a1",
  businessName: "나라 사슴길 투어",
  contactName: "정나래",
  contactPhone: "010-2345-6789",
  contactEmail: "nara@example.com",
  intro:
    "나라 공원과 도다이지를 걷는 소규모 가이드 투어를 운영합니다.\n한국어 가이드가 동행하고, 최대 8명까지 진행해요.",
  status: "pending",
  rejectReason: null,
  createdAt: "2026-10-20T01:30:00Z",
  reviewedAt: null,
  applicantName: "나래",
};

export const MOCK_APPLICATIONS: PartnerApplication[] = [PENDING];

export const MOCK_REVIEWED_APPLICATIONS: PartnerApplication[] = [
  {
    ...PENDING,
    id: "00000000-0000-4000-8000-0000000000a2",
    businessName: "오사카 야경 크루즈",
    status: "rejected",
    rejectReason: "사업자 정보와 운영 상품을 더 자세히 적어 주세요.",
    reviewedAt: "2026-10-19T05:10:00Z",
  },
];

export const MOCK_PARTNERS: PartnerRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000011",
    name: "하루 트래블",
    contactName: "김하루",
    contactPhone: "02-555-0101",
    contactEmail: "haru@partners.yeoun.test",
    status: "active",
    commissionRate: 15,
    productCount: 8,
    hasOwner: true,
    createdAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    name: "교토 모노가타리",
    contactName: "이서윤",
    contactPhone: "051-555-0202",
    contactEmail: "monogatari@partners.yeoun.test",
    status: "suspended",
    commissionRate: 12.5,
    productCount: 8,
    hasOwner: true,
    createdAt: "2026-10-02T00:00:00Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "여운 직영",
    contactName: "여운 운영팀",
    contactPhone: "02-1234-5678",
    contactEmail: "partners@yeoun.example",
    status: "active",
    commissionRate: 15,
    productCount: 0,
    hasOwner: false,
    createdAt: "2026-09-01T00:00:00Z",
  },
];
