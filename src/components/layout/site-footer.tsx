import Link from "next/link";

/** 푸터 (명세 4.1 하이파이 하단) + 약관·처리방침 링크 · 통신판매중개자 고지 (A-04) */
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col gap-3 py-8 text-sm text-muted-foreground">
        <nav aria-label="약관" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/terms" className="hover:underline">
            이용약관
          </Link>
          <Link href="/privacy" className="font-semibold text-foreground hover:underline">
            개인정보 처리방침
          </Link>
        </nav>
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
