/** 푸터 (명세 4.1 하이파이 하단) */
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col gap-1 py-8 text-sm text-muted-foreground md:flex-row md:justify-between">
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
    </footer>
  );
}
