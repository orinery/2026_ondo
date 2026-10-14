"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * 라이트/다크 전환 버튼.
 * 아이콘은 CSS(dark: 변형)로 바꾼다. 왜: 서버는 사용자의 테마를 모르기 때문에
 * JS로 아이콘을 고르면 hydration 불일치가 생긴다. CSS로 고르면 서버·클라이언트 HTML이 같다.
 */
export function ThemeToggle({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="라이트/다크 모드 전환"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "grid size-10 place-items-center rounded-full border transition-colors duration-fast",
        onDark ? "border-white/50 text-white hover:bg-white/10" : "border-input hover:bg-muted",
        className,
      )}
    >
      <SunIcon aria-hidden className="size-4.5 dark:hidden" />
      <MoonIcon aria-hidden className="hidden size-4.5 dark:block" />
    </button>
  );
}
