import type { PartnerBooking } from "@/lib/data/partner-center";
import type { PartnerApplication, PartnerRow } from "@/lib/data/partners";
import type { SettlementItem, SettlementRow } from "@/lib/data/settlements";

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

/** 파트너 예약 목록 목업 — 확정 대기(처리 버튼) · 확정(바우처) · 거절(사유) */
export const MOCK_PARTNER_BOOKINGS: PartnerBooking[] = [
  {
    itemId: "00000000-0000-4000-8000-0000000000b1",
    orderNo: "YO261021-000041",
    productId: "p-snorkel",
    productTitle: "푸른 동굴 스노클링",
    useDate: "2026-11-04",
    startTime: "09:00",
    adultQty: 2,
    childQty: 0,
    subtotal: 126000,
    refundAmount: null,
    status: "pending",
    displayStatus: "pending",
    confirmDeadline: "2026-10-23T03:00:00Z",
    voucherCode: null,
    rejectReason: null,
    options: "호텔 픽업",
    bookerName: "김여운",
    bookerPhone: "010-1234-5678",
    bookerEmail: "yeoun@example.com",
    paidAt: "2026-10-21T03:00:00Z",
  },
  {
    itemId: "00000000-0000-4000-8000-0000000000b2",
    orderNo: "YO261019-000033",
    productId: "p-snorkel",
    productTitle: "푸른 동굴 스노클링",
    useDate: "2026-11-04",
    startTime: "13:00",
    adultQty: 1,
    childQty: 1,
    subtotal: 98000,
    refundAmount: null,
    status: "confirmed",
    displayStatus: "confirmed",
    confirmDeadline: null,
    voucherCode: "7F31C0A9D2",
    rejectReason: null,
    options: "",
    bookerName: "이하늘",
    bookerPhone: "010-2222-3333",
    bookerEmail: "sky@example.com",
    paidAt: "2026-10-19T03:00:00Z",
  },
  {
    itemId: "00000000-0000-4000-8000-0000000000b3",
    orderNo: "YO261018-000027",
    productId: "p-kerama",
    productTitle: "게라마 제도 당일 투어",
    useDate: "2026-11-06",
    startTime: "08:00",
    adultQty: 2,
    childQty: 0,
    subtotal: 250000,
    refundAmount: 250000,
    status: "rejected",
    displayStatus: "rejected",
    confirmDeadline: null,
    voucherCode: null,
    rejectReason: "기상 악화로 해당 날짜 운항이 취소됐어요",
    options: "",
    bookerName: "박소라",
    bookerPhone: "010-4444-5555",
    bookerEmail: "sora@example.com",
    paidAt: "2026-10-18T03:00:00Z",
  },
];

/** 정산 목업 — 이번 달(집계 중) · 지난달(정산 예정) · 두 달 전(정산 완료) */
const SETTLEMENT_PARTNER = {
  partnerId: "00000000-0000-4000-8000-000000000013",
  partnerName: "유키시마 트래블",
};

export const MOCK_SETTLEMENT_ROWS: SettlementRow[] = [
  {
    ...SETTLEMENT_PARTNER,
    month: "2026-10-01",
    itemCount: 4,
    revenue: 356000,
    commission: 53400,
    payout: 302600,
    settledAt: null,
    state: "open",
  },
  {
    ...SETTLEMENT_PARTNER,
    month: "2026-09-01",
    itemCount: 7,
    revenue: 612000,
    commission: 91800,
    payout: 520200,
    settledAt: null,
    state: "pending",
  },
  {
    ...SETTLEMENT_PARTNER,
    month: "2026-08-01",
    itemCount: 5,
    revenue: 452000,
    commission: 67800,
    payout: 384200,
    settledAt: "2026-09-03T02:00:00Z",
    state: "settled",
  },
];

export const MOCK_SETTLEMENT_ITEMS: SettlementItem[] = [
  {
    itemId: "s1",
    orderNo: "YO260901-000012",
    productTitle: "푸른 동굴 스노클링",
    useDate: "2026-09-12",
    status: "used",
    subtotal: 126000,
    refund: 0,
    revenue: 126000,
    commissionRate: 15,
    commission: 18900,
  },
  {
    itemId: "s2",
    orderNo: "YO260905-000020",
    productTitle: "게라마 제도 당일 투어",
    useDate: "2026-09-20",
    status: "confirmed",
    subtotal: 250000,
    refund: 0,
    revenue: 250000,
    commissionRate: 15,
    commission: 37500,
  },
  {
    itemId: "s3",
    orderNo: "YO260910-000031",
    productTitle: "오키나와 북부 버스 투어",
    useDate: "2026-09-25",
    status: "cancelled",
    subtotal: 104000,
    refund: 52000,
    revenue: 52000,
    commissionRate: 15,
    commission: 7800,
  },
];
