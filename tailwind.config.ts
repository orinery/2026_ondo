import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

/**
 * 여운 Yeoun — Design Tokens v1.0
 * 출처: design/yeoun-design-system.dc.html "03 Tailwind" 섹션
 *
 * 명세는 Tailwind v3 기준이고, 이 프로젝트는 v4 + `@config`(globals.css)로 이 파일을 불러온다.
 * 명세와 다른 점(사용자 확정 사항):
 * 1) 시맨틱 컬러 변수는 RGB 채널이 아니라 HEX로 저장하고 `var(--x)`로 참조한다.
 *    왜: shadcn 4 컴포넌트가 `color-mix(in oklch, var(--secondary), …)`처럼 변수를 완성된 색으로 쓰기 때문.
 *    `bg-primary/80` 같은 투명도 수식어는 v4가 color-mix로 처리하므로 그대로 동작한다.
 * 2) `content`는 v4가 소스를 자동 탐지하므로 생략, `tailwindcss-animate`는 v4용 `tw-animate-css`(CSS import)로 대체.
 * 3) Tailwind 기본 팔레트(blue-500 등)는 globals.css에서 `--color-*: initial`로 제거해 토큰 외 색을 원천 차단한다.
 * 4) `darkMode: ["class"]`는 globals.css의 `@custom-variant dark`로 옮겼다 (v4 방식, 중복 정의 방지).
 * 5) v4의 defaultTheme은 default export만 제공하므로 `import { fontFamily }` 대신 구조 분해한다.
 */

const { fontFamily } = defaultTheme;

// 시맨틱 토큰 → CSS 변수 참조 (실제 값은 globals.css의 :root / .dark)
const semantic = (name: string) => `var(--${name})`;

const config = {
  theme: {
    // mobile-first: 기본 = 360, md = 768, xl = 1280
    screens: { sm: "360px", md: "768px", lg: "1024px", xl: "1280px" },
    // container(좌우 여백 20 / 32 / 40, 최대 1280)는 globals.css의 `@utility container`에 정의한다.
    // 왜: v4 호환 레이어가 container.screens에 없는 md 패딩(32px)을 출력하지 않는 것을 빌드 결과로 확인했기 때문.
    extend: {
      colors: {
        // semantic (globals.css 변수 참조)
        background: semantic("background"),
        foreground: semantic("foreground"),
        card: { DEFAULT: semantic("card"), foreground: semantic("card-foreground") },
        popover: { DEFAULT: semantic("popover"), foreground: semantic("popover-foreground") },
        primary: { DEFAULT: semantic("primary"), foreground: semantic("primary-foreground") },
        secondary: { DEFAULT: semantic("secondary"), foreground: semantic("secondary-foreground") },
        muted: { DEFAULT: semantic("muted"), foreground: semantic("muted-foreground") },
        accent: { DEFAULT: semantic("accent"), foreground: semantic("accent-foreground") },
        highlight: { DEFAULT: semantic("highlight"), foreground: semantic("highlight-foreground") },
        destructive: {
          DEFAULT: semantic("destructive"),
          foreground: semantic("destructive-foreground"),
        },
        success: semantic("success"),
        warning: semantic("warning"),
        border: semantic("border"),
        input: semantic("input"),
        ring: semantic("ring"),
        // 사진 위 텍스트 전용 (명세 2.3 대비 검증 "white / 히어로 스크림 하단")
        white: "#FFFFFF",
        // brand scales
        moss: {
          50: "#F1F5F1",
          100: "#DDE8DF",
          200: "#BBD1C0",
          300: "#93B59B",
          400: "#6B9776",
          500: "#4C7B59",
          600: "#3B6447",
          700: "#304F3A",
          800: "#283F30",
          900: "#1F3126",
        },
        lake: {
          50: "#EEF4F7",
          100: "#D6E5EC",
          200: "#AECBD9",
          300: "#80ABC1",
          400: "#5A8DA8",
          500: "#42738F",
          600: "#355D75",
          700: "#2C4C5F",
          800: "#243E4D",
          900: "#1C303C",
        },
        glow: {
          50: "#FDF2EE",
          100: "#FBE0D7",
          200: "#F6BFAE",
          300: "#F09A82",
          400: "#E7785D",
          500: "#D65E42",
          600: "#B44A33",
          700: "#8F3B2A",
          800: "#6E2F23",
          900: "#50231B",
        },
        stone: {
          50: "#FAF9F6",
          100: "#F2F0EB",
          200: "#E5E1D9",
          300: "#D1CBC0",
          400: "#A8A195",
          500: "#7C766B",
          600: "#5D584F",
          700: "#45413A",
          800: "#2D2A26",
          900: "#1B1A17",
        },
      },
      fontFamily: {
        display: ["var(--font-instrument-serif)", "var(--font-plex-kr)", ...fontFamily.serif],
        sans: ["var(--font-dm-sans)", "var(--font-plex-kr)", ...fontFamily.sans],
        kr: ["var(--font-plex-kr)", ...fontFamily.sans],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.125rem" }], // 12 / 18
        sm: ["0.875rem", { lineHeight: "1.375rem" }], // 14 / 22
        base: ["1rem", { lineHeight: "1.625rem" }], // 16 / 26
        lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18 / 28
        xl: ["1.25rem", { lineHeight: "1.875rem", letterSpacing: "-0.01em" }], // 20 / 30
        "2xl": ["1.5rem", { lineHeight: "2.125rem", letterSpacing: "-0.015em" }], // 24 / 34
        "3xl": ["1.875rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em" }], // 30 / 40
        "4xl": ["2.5rem", { lineHeight: "3.125rem", letterSpacing: "-0.025em" }], // 40 / 50
        "5xl": ["3.5rem", { lineHeight: "4rem", letterSpacing: "-0.03em" }], // 56 / 64
      },
      spacing: {
        "4.5": "1.125rem",
        "section-sm": "3rem", // 48 — 모바일 섹션 간격
        section: "5rem", // 80 — 태블릿 / 기본
        "section-lg": "7.5rem", // 120 — 데스크톱 섹션 간격
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)", // 6 칩 내부, 배지
        md: "var(--radius)", // 10 버튼, 입력
        lg: "calc(var(--radius) + 6px)", // 16 카드, 이미지
        xl: "24px", // 컬렉션 타일, 시트
      },
      boxShadow: {
        xs: "0 1px 2px rgb(45 42 38 / 0.06)",
        sm: "0 2px 6px -1px rgb(45 42 38 / 0.08), 0 1px 2px rgb(45 42 38 / 0.04)",
        md: "0 12px 24px -8px rgb(45 42 38 / 0.18)",
        lg: "0 20px 40px -12px rgb(45 42 38 / 0.25)",
        // HEX 변수이므로 rgb(var() / a) 대신 color-mix로 35% 투명도를 만든다
        focus: "0 0 0 3px color-mix(in oklab, var(--ring) 35%, transparent)",
      },
      transitionDuration: { fast: "150ms", base: "220ms", slow: "360ms" },
      transitionTimingFunction: { "out-soft": "cubic-bezier(0.2, 0.7, 0.2, 1)" },
      aspectRatio: { card: "4 / 5", tile: "3 / 2", hero: "16 / 7" },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "fade-up": "fade-up 360ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        // accordion 키프레임은 shadcn/tailwind.css가 제공
        "accordion-down": "accordion-down 220ms ease-out",
        "accordion-up": "accordion-up 220ms ease-out",
      },
    },
  },
} satisfies Config;

export default config;
