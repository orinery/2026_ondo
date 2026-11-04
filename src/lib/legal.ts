/**
 * 예약 정보 파트너 제공 고지 — 주문서 동의 문구와 개인정보 처리방침이 같은 내용을 쓴다 (A-04).
 * 보유 기간은 파트너 예약 목록의 연락처 가리기 규칙(0031 partner_bookings)과 같다.
 */
export const PII_SHARE = {
  recipient: "주문한 상품을 판매하는 파트너(상품 페이지·예약 내역에 표시)",
  items: "예약자 이름, 휴대폰 번호, 이메일, 예약 내용(상품·이용일·회차·인원·옵션)",
  purpose: "예약 확정과 이행, 이용일 현장 연락, 이용 후 문의 응대",
  period:
    "이용일 7일 뒤까지 원문 열람, 그 뒤와 취소·거절된 예약은 가린 값으로만 보임 (관계 법령에 따른 보관은 회사가 함)",
} as const;

/**
 * 플랫폼(통신판매중개자) 사업자 정보 — 푸터에 표시 (전자상거래법 제10조 사이버몰 운영자 표시, Q3).
 * 포트폴리오 예시 값: 실제 사업자가 아니며, 번호·주소는 실제와 겹치지 않게 만든 값이다.
 */
export const COMPANY = {
  name: "여운(Yeoun)",
  representative: "김여운",
  businessRegNo: "123-45-00000",
  mailOrderNo: "제2026-서울중구-0000호", // 통신판매업 신고번호
  tourismLicenseNo: "제2026-000000호", // 관광사업(여행업) 등록번호
  address: "서울특별시 중구 예시로 1",
  phone: "02-0000-0000",
  hours: "평일 10:00~18:00",
  email: "help@yeoun.example",
  hosting: "Vercel Inc.",
} as const;
