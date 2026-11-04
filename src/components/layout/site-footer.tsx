import Link from "next/link";

import { COMPANY } from "@/lib/legal";

/**
 * 푸터 (명세 4.1 하이파이 하단) + 약관·처리방침 링크 · 통신판매중개자 고지 (A-04)
 * + 사업자 정보 (전자상거래법 제10조 표시 항목, Q3 — 포트폴리오 예시 값)
 */
export function SiteFooter() {
  return (
    <footer className="border-t print:hidden">
      <div className="container flex flex-col gap-3 py-8 text-sm text-muted-foreground">
        <nav aria-label="약관" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/terms" className="hover:underline">
            이용약관
          </Link>
          <Link href="/privacy" className="font-semibold text-foreground hover:underline">
            개인정보 처리방침
          </Link>
        </nav>
        <dl
          aria-label="사업자 정보 (포트폴리오 예시)"
          className="flex max-w-3xl flex-wrap gap-x-3 gap-y-0.5 text-xs leading-5"
        >
          <Info label="상호">{COMPANY.name}</Info>
          <Info label="대표">{COMPANY.representative}</Info>
          <Info label="사업자등록번호">{COMPANY.businessRegNo}</Info>
          <Info label="통신판매업 신고">{COMPANY.mailOrderNo}</Info>
          <Info label="여행업 등록">{COMPANY.tourismLicenseNo}</Info>
          <Info label="주소">{COMPANY.address}</Info>
          <Info label="고객센터">
            {COMPANY.phone} ({COMPANY.hours}) · {COMPANY.email}
          </Info>
          <Info label="호스팅">{COMPANY.hosting}</Info>
        </dl>
        <p className="max-w-3xl text-xs leading-5">
          여운은 통신판매중개자로서 상품 거래의 당사자가 아니며, 상품 정보와 예약 이행의 책임은 각
          상품을 판매하는 파트너에게 있습니다. (포트폴리오 예시 고지 — 실제 사업자 아님)
        </p>
        <div className="flex flex-col gap-1 md:flex-row md:justify-between">
          <p>© 2026 여운 Yeoun · 포트폴리오 프로젝트</p>
          <p>
            Photos ·{" "}
            <a
              href="https://unsplash.com"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              Unsplash
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-1">
      <dt>{label}</dt>
      <dd className="text-foreground/80">{children}</dd>
    </div>
  );
}
