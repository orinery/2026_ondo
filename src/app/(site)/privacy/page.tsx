import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { PII_SHARE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "여운 개인정보 처리방침 (포트폴리오 예시 문안)",
};

/**
 * 개인정보 처리방침 (/privacy) — 포트폴리오 예시 문안 (A-04).
 * 수집 항목·보유 기간·파트너 제공·접근 통제는 실제 구현(스키마·RLS·0030 주문 보존·0031 연락처 가리기)과 맞춘다.
 */
const SECTIONS: LegalSection[] = [
  {
    id: "collect",
    title: "수집하는 개인정보",
    body: (
      <table>
        <thead>
          <tr>
            <th scope="col">언제</th>
            <th scope="col">항목</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>회원가입</td>
            <td>이름, 이메일, 비밀번호(암호화해 저장)</td>
          </tr>
          <tr>
            <td>주문</td>
            <td>예약자 이름·휴대폰 번호·이메일, 예약 내용, 결제·환불 기록(모의 결제)</td>
          </tr>
          <tr>
            <td>파트너 신청</td>
            <td>사업자명, 담당자 이름·연락처·이메일, 소개</td>
          </tr>
          <tr>
            <td>리뷰·신고</td>
            <td>리뷰 내용·별점·사진, 신고 사유</td>
          </tr>
          <tr>
            <td>자동 수집</td>
            <td>로그인 유지용 쿠키, 서비스 이용 기록(예약 처리 이력)</td>
          </tr>
        </tbody>
      </table>
    ),
  },
  {
    id: "purpose",
    title: "이용 목적",
    body: (
      <ul>
        <li>회원 식별과 로그인, 예약·결제·취소·환불 처리</li>
        <li>파트너를 통한 예약 확정·이행, 이용일 연락</li>
        <li>고객 문의·분쟁 처리, 부정 이용 방지</li>
        <li>파트너 심사와 판매 대금 정산</li>
      </ul>
    ),
  },
  {
    id: "retention",
    title: "보유 기간과 파기",
    body: (
      <>
        <p>
          회원 정보는 탈퇴하면 바로 지웁니다. 다만 아래 기록은 관계 법령(전자상거래법 시행령
          제6조)에 따라 정해진 기간 동안 보관한 뒤 파기합니다. 회원 계정을 지워도 주문 기록은 남고,
          관리자만 볼 수 있습니다.
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">기록</th>
              <th scope="col">보관 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>계약·청약철회, 대금 결제·환불 기록 (주문·예약자 정보 포함)</td>
              <td>5년</td>
            </tr>
            <tr>
              <td>소비자 불만·분쟁 처리 기록 (취소 사유, 환불 조정, 상담 메모)</td>
              <td>3년</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "share",
    title: "예약 정보의 파트너 제공",
    body: (
      <>
        <p>
          상품을 예약하면 예약 이행을 위해 아래 정보를 판매 파트너에게 제공합니다. 주문서에서 따로
          동의를 받으며, 동의하지 않으면 예약할 수 없습니다.
        </p>
        <table>
          <tbody>
            <tr>
              <th scope="row">받는 곳</th>
              <td>{PII_SHARE.recipient}</td>
            </tr>
            <tr>
              <th scope="row">항목</th>
              <td>{PII_SHARE.items}</td>
            </tr>
            <tr>
              <th scope="row">목적</th>
              <td>{PII_SHARE.purpose}</td>
            </tr>
            <tr>
              <th scope="row">기간</th>
              <td>{PII_SHARE.period}</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "outsource",
    title: "처리 위탁과 국외 이전",
    body: (
      <ul>
        <li>Supabase — 데이터베이스·인증·파일 저장 (서버 위치: 호주 시드니)</li>
        <li>Vercel — 웹사이트 호스팅 (서버 위치: 호주 시드니)</li>
      </ul>
    ),
  },
  {
    id: "safety",
    title: "안전성 확보 조치",
    body: (
      <ul>
        <li>
          모든 데이터에 역할별 접근 통제(행 수준 보안)를 적용해 본인·담당 파트너·관리자만 필요한
          정보를 봅니다.
        </li>
        <li>예약 처리·관리자 조치는 누가 언제 무엇을 했는지 기록합니다.</li>
        <li>내려받는 주문 목록 파일에는 예약자 연락처를 넣지 않습니다.</li>
        <li>비밀번호는 암호화해 저장하고, 로그인은 서명된 토큰으로 확인합니다.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "이용자의 권리",
    body: (
      <p>
        회원은 언제든 자신의 개인정보를 열람·정정하거나 삭제(탈퇴)를 요청할 수 있습니다. 법령에 따라
        보관해야 하는 정보는 그 기간이 끝난 뒤 지웁니다.
      </p>
    ),
  },
  {
    id: "officer",
    title: "개인정보 보호책임자",
    body: <p>여운 개인정보 보호책임자 (예시) · privacy@yeoun.example</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="개인정보 처리방침"
      effectiveDate="2026년 10월 27일"
      sections={SECTIONS}
      related={{ href: "/terms", label: "이용약관" }}
    />
  );
}
