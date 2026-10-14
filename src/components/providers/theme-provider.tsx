"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * 라이트/다크 모드 전환.
 * - 기본값은 OS 설정(system)을 따르고, 사용자가 토글하면 localStorage에 기억한다.
 * - attribute="class": 명세대로 <html>에 .dark 클래스를 붙여 globals.css의 변수를 교체한다.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
