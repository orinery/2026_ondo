import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * URL 쿼리와 동기화되는 탭 (링크로 구현 — 나의 여행 탭과 같은 모양).
 * 새로고침·공유해도 같은 탭이 열리고, 서버 컴포넌트에서 바로 쓸 수 있다.
 */
export function UrlTabs({
  label,
  tabs,
  current,
}: {
  label: string;
  tabs: { href: string; value: string; label: string; count?: number }[];
  current: string;
}) {
  return (
    // 탭이 많아 360에서 넘치면 줄바꿈 대신 가로로 스크롤한다 (탭 높이를 고정하기 위해)
    <nav
      aria-label={label}
      className="flex w-full max-w-xl overflow-x-auto rounded-md bg-muted p-1"
    >
      {tabs.map((t) => (
        <Link
          key={t.value}
          href={t.href}
          scroll={false}
          aria-current={current === t.value ? "page" : undefined}
          className={cn(
            "flex h-11 flex-1 shrink-0 items-center justify-center gap-1.5 rounded-sm px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-fast",
            current === t.value && "bg-card font-semibold text-foreground shadow-sm",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="tabular-nums">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
