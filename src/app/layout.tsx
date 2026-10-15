import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Sans_KR, Instrument_Serif } from "next/font/google";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// 폰트 설정은 명세 "03 Tailwind > app/layout.tsx"를 그대로 따른다.
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const kr = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex-kr",
  display: "swap",
  // 한글 폰트는 용량이 커서 preload하지 않는다 (명세 그대로)
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "여운 Yeoun",
    template: "%s | 여운",
  },
  description:
    "떠나기 전의 설렘이 돌아온 뒤의 여운으로. 일본 여행 투어·액티비티와 입장권을 예약하는 여행 쇼핑몰",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes가 hydration 전에 <html>에 .dark 클래스를 붙이기 때문
    <html
      lang="ko"
      className={[display.variable, sans.variable, kr.variable].join(" ")}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
