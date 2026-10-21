"use client";

import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  LayoutDashboardIcon,
  MenuIcon,
  PackageIcon,
  StoreIcon,
  TicketCheckIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ConsoleSection = "partner" | "admin";
type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

// 메뉴는 단계마다 늘어난다 (S6 대시보드·주문·신고)
const NAV: Record<ConsoleSection, { title: string; items: NavItem[] }> = {
  partner: {
    title: "파트너 센터",
    items: [
      { href: "/partner", label: "홈", icon: LayoutDashboardIcon, exact: true },
      { href: "/partner/products", label: "상품", icon: PackageIcon },
      { href: "/partner/bookings", label: "예약", icon: CalendarCheckIcon },
      { href: "/partner/vouchers", label: "바우처 사용 처리", icon: TicketCheckIcon },
      { href: "/partner/settlements", label: "정산", icon: WalletIcon },
    ],
  },
  admin: {
    title: "관리자 콘솔",
    items: [
      { href: "/admin/partners", label: "파트너", icon: StoreIcon },
      { href: "/admin/settlements", label: "정산", icon: WalletIcon },
    ],
  },
};

/**
 * 파트너 센터·관리자 콘솔 공통 틀 (하이파이에 없는 화면 — 기존 토큰·컴포넌트로 구성)
 * - 768 이상: 왼쪽 사이드바(240) + 본문
 * - 767 이하: 상단 바 + 메뉴 버튼 → 시트(사이드바와 같은 메뉴)
 * 메뉴 아이콘(함수)은 서버 컴포넌트에서 넘길 수 없어 구역 이름만 받고 여기서 고른다.
 */
export function ConsoleShell({
  section,
  userName,
  subtitle,
  preview = false,
  children,
}: {
  section: ConsoleSection;
  userName: string;
  subtitle?: string; // 파트너 이름 등
  preview?: boolean; // /dev/components 미리보기: 화면 높이 고정·sticky를 풀고 본문 id를 붙이지 않는다
  children: React.ReactNode;
}) {
  const { title } = NAV[section];
  const [open, setOpen] = useState(false);
  // 미리보기는 쇼케이스 섹션 안에 들어가므로 보조 랜드마크(aside)를 중첩하지 않는다 (axe landmark 규칙)
  const Sidebar = preview ? "div" : "aside";

  return (
    <div className={cn("flex flex-col md:flex-row", preview ? "min-h-[32rem]" : "min-h-dvh")}>
      {/* 767 이하 상단 바 */}
      <header
        className={cn(
          "z-40 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur md:hidden",
          !preview && "sticky top-0",
        )}
      >
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="콘솔 메뉴"
              className="grid size-11 place-items-center rounded-full hover:bg-muted"
            >
              <MenuIcon aria-hidden className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 gap-0 p-0">
            <SheetTitle className="sr-only">{title} 메뉴</SheetTitle>
            <SheetDescription className="sr-only">{title}의 화면 목록</SheetDescription>
            <SidebarBody
              section={section}
              userName={userName}
              subtitle={subtitle}
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <p className="min-w-0 flex-1 truncate font-kr font-semibold">{title}</p>
        <ThemeToggle />
      </header>

      {/* 768 이상 사이드바 */}
      <Sidebar
        className={cn(
          "hidden w-60 shrink-0 border-r bg-card md:block",
          !preview && "sticky top-0 h-dvh",
        )}
      >
        <SidebarBody section={section} userName={userName} subtitle={subtitle} />
      </Sidebar>

      {/* 미리보기는 쇼케이스 페이지 안에 들어가므로 main 랜드마크·본문 id를 중복해서 만들지 않는다 */}
      {preview ? (
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      ) : (
        <main id="main-content" className="flex min-w-0 flex-1 flex-col">
          {children}
        </main>
      )}
    </div>
  );
}

function SidebarBody({
  section,
  userName,
  subtitle,
  onNavigate,
}: {
  section: ConsoleSection;
  userName: string;
  subtitle?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { title, items } = NAV[section];

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex flex-col gap-0.5 px-2 pt-2">
        <Link href="/" onClick={onNavigate} className="flex items-baseline gap-2 rounded-sm">
          <span className="font-kr text-lg font-semibold tracking-tight">여운</span>
          <span className="font-display text-lg text-muted-foreground">Yeoun</span>
        </Link>
        <p className="text-sm font-semibold text-primary">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <nav aria-label={`${title} 메뉴`} className="flex flex-col gap-1">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-fast",
                active
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t pt-4">
        <p className="truncate px-2 text-sm">{userName}님</p>
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            onClick={onNavigate}
            className="flex h-10 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            사이트로 돌아가기
          </Link>
          <ThemeToggle className="hidden md:grid" />
        </div>
      </div>
    </div>
  );
}

/** 콘솔 페이지 제목 줄 (페이지마다 같은 모양) */
export function ConsolePageHeader({
  eyebrow,
  title,
  description,
  actions,
  as: Heading = "h1",
}: {
  eyebrow: string;
  title: string;
  as?: "h1" | "h2"; // 쇼케이스처럼 다른 제목 아래에 들어갈 때 h2
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <p className="font-display text-xl text-muted-foreground italic">{eyebrow}</p>
        <Heading className="font-kr text-3xl font-semibold">{title}</Heading>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </header>
  );
}
