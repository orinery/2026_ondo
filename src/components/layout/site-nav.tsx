"use client";

import {
  CompassIcon,
  HeartIcon,
  HouseIcon,
  MenuIcon,
  SearchIcon,
  ShoppingBagIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { signOut } from "@/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UserRole } from "@/lib/constants/taxonomy";
import { cn } from "@/lib/utils";

import { SearchCommand, type SearchCity, type SearchItem } from "./search-command";
import { ThemeToggle } from "./theme-toggle";

export type NavUser = { name: string; avatarUrl: string | null; role: UserRole };

// 역할별 계정 메뉴 링크: 파트너 → 파트너 센터, 관리자 → 관리자 콘솔, 고객 → 파트너 신청
const ROLE_LINK: Record<UserRole, { href: string; label: string }> = {
  customer: { href: "/partner-apply", label: "파트너 신청" },
  partner: { href: "/partner", label: "파트너 센터" },
  admin: { href: "/admin", label: "관리자 콘솔" },
};

type SiteNavProps = {
  user: NavUser | null; // null = 비로그인
  isUserLoading?: boolean; // 아바타 스켈레톤 (명세 5.5 loading)
  // 히어로 위에서는 투명 → 스크롤하면 bg-background (명세 5.5 1280)
  overHero?: boolean;
  searchItems?: SearchItem[];
  searchCities?: SearchCity[];
  cartCount?: number; // 장바구니 배지 (비로그인 0)
  // 디자인 QA 전용(/dev/components): 고정 위치·하단 탭·건너뛰기 링크 없이 박스 안에 그린다
  preview?: boolean;
};

type MenuItem = {
  href: string;
  label: string; // 1280
  shortLabel: string; // 768 (명세: 메뉴 라벨 축약)
  // category: 목록 URL의 ?category= (투어·티켓 메뉴를 구분해 표시)
  isActive: (pathname: string, category: string | null) => boolean;
  requiresAuth?: boolean;
};

const MENU: MenuItem[] = [
  {
    href: "/products?category=tour",
    label: "투어·액티비티",
    shortLabel: "투어",
    isActive: (p, c) => p === "/products" && c === "tour",
  },
  {
    href: "/products?category=ticket",
    label: "티켓·패스",
    shortLabel: "티켓",
    isActive: (p, c) => p === "/products" && c === "ticket",
  },
  // 사용자 확정: 별도 페이지 없이 메인의 컬렉션 섹션으로 이동
  { href: "/#collections", label: "테마 컬렉션", shortLabel: "테마", isActive: () => false },
  {
    href: "/my",
    label: "나의 여행",
    shortLabel: "나의 여행",
    isActive: (p) => p.startsWith("/my"),
    requiresAuth: true,
  },
];

/**
 * 반응형 내비게이션 (명세 5.5 · NavigationMenu, Sheet)
 * - 1280: 높이 72 · 로고(+Yeoun) · 메뉴 4개 · 찜 · 장바구니(개수) · 테마 토글 · 로그인/아바타
 * - 768: 높이 64 · 라벨 축약 · 검색 아이콘 → Command 팔레트
 * - 360: 상단 56(로고·검색·메뉴 Sheet) + 하단 탭 4개(홈·탐색·장바구니·나의 여행, 사용자 확정)
 */
export function SiteNav({
  user,
  isUserLoading = false,
  overHero: overHeroProp,
  searchItems = [],
  searchCities = [],
  cartCount = 0,
  preview = false,
}: SiteNavProps) {
  const pathname = usePathname();
  // 지정하지 않으면 풀블리드 히어로가 있는 메인(/)에서만 투명 모드
  const overHero = overHeroProp ?? pathname === "/";
  const [searchOpen, setSearchOpen] = useState(false);
  const scrolled = useScrolled();

  // 히어로 위 + 스크롤 전에만 투명 모드
  const transparent = overHero && (preview || !scrolled);

  return (
    <>
      {!preview && (
        <a
          href="#main-content"
          className="sr-only z-50 rounded-md bg-background px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          본문 바로가기
        </a>
      )}

      <header
        className={cn(
          "inset-x-0 top-0 z-30 transition-colors duration-base",
          preview ? "relative" : overHero ? "fixed" : "sticky",
          transparent
            ? "bg-transparent text-white"
            : "border-b bg-background/95 text-foreground backdrop-blur",
        )}
      >
        <div className="container flex h-14 items-center justify-between gap-4 md:h-16 xl:h-18">
          <div className="flex items-center gap-5 xl:gap-12">
            <Link href="/" className="flex items-baseline gap-2 rounded-sm">
              <span className="font-kr text-lg font-semibold tracking-tight xl:text-2xl">여운</span>
              <span
                className={cn(
                  "hidden font-display text-xl xl:inline",
                  transparent ? "text-white" : "text-muted-foreground",
                )}
              >
                Yeoun
              </span>
            </Link>

            <NavigationMenu viewport={false} className="hidden md:flex" aria-label="주 메뉴">
              <NavigationMenuList className="gap-5 xl:gap-8">
                <WithCategory>
                  {(category) =>
                    MENU.map((item) => (
                      <NavigationMenuItem key={item.href}>
                        <MenuLink
                          item={item}
                          active={item.isActive(pathname, category)}
                          disabled={item.requiresAuth && !user}
                          transparent={transparent}
                        />
                      </NavigationMenuItem>
                    ))
                  }
                </WithCategory>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="flex items-center gap-2.5">
            {/* 1280에서는 검색 아이콘을 두지 않는다 (명세 5.5) */}
            <IconButton
              label="상품 검색"
              onClick={() => setSearchOpen(true)}
              transparent={transparent}
              className="xl:hidden"
            >
              <SearchIcon aria-hidden className="size-5" />
            </IconButton>

            <Link
              href="/my?tab=likes"
              aria-label="찜 목록"
              className={cn(
                "hidden size-10 place-items-center rounded-full border transition-colors duration-fast md:grid",
                transparent ? "border-white/50 hover:bg-white/10" : "border-input hover:bg-muted",
              )}
            >
              <HeartIcon aria-hidden className="size-4.5" />
            </Link>

            <CartLink count={cartCount} transparent={transparent} />

            <ThemeToggle onDark={transparent} className="hidden md:grid" />

            <div className="hidden md:block">
              <UserArea user={user} isLoading={isUserLoading} transparent={transparent} />
            </div>

            <MobileMenu user={user} pathname={pathname} transparent={transparent} />
          </div>
        </div>
      </header>

      {/* 360: 하단 탭 (useSearchParams를 쓰므로 Suspense로 감싼다 — 정적 페이지 빌드 요구사항) */}
      {!preview && <BottomTabs pathname={pathname} cartCount={cartCount} />}

      <SearchCommand
        items={searchItems}
        cities={searchCities}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </>
  );
}

/**
 * URL의 ?category=를 읽어 children에 넘긴다.
 * useSearchParams는 정적 페이지 빌드에서 Suspense 경계가 필요하므로 여기서 감싸고,
 * 그동안(fallback)은 category 없이 그린다.
 */
function WithCategory({ children }: { children: (category: string | null) => React.ReactNode }) {
  return (
    <Suspense fallback={children(null)}>
      <WithCategoryInner>{children}</WithCategoryInner>
    </Suspense>
  );
}

function WithCategoryInner({
  children,
}: {
  children: (category: string | null) => React.ReactNode;
}) {
  const searchParams = useSearchParams();
  return children(searchParams.get("category"));
}

/** 장바구니 아이콘 + 개수 배지 (768 이상 상단, 360은 하단 탭) */
function CartLink({ count, transparent }: { count: number; transparent: boolean }) {
  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `장바구니, ${count}개 담김` : "장바구니"}
      className={cn(
        "relative hidden size-10 place-items-center rounded-full border transition-colors duration-fast md:grid",
        transparent ? "border-white/50 hover:bg-white/10" : "border-input hover:bg-muted",
      )}
    >
      <ShoppingBagIcon aria-hidden className="size-4.5" />
      {count > 0 && <CountBadge count={count} className="-top-1 -right-1" />}
    </Link>
  );
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground tabular-nums",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function MenuLink({
  item,
  active,
  disabled,
  transparent,
}: {
  item: MenuItem;
  active: boolean;
  disabled?: boolean;
  transparent: boolean;
}) {
  const base = "border-b-2 border-transparent pt-1 pb-1 text-sm font-medium xl:text-base";

  // disabled (비로그인 + 로그인 필요 메뉴): muted + 로그인 유도 툴팁 (명세 5.5 States)
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-disabled="true"
            className={cn(
              base,
              "cursor-not-allowed",
              transparent ? "text-white/60" : "text-muted-foreground",
            )}
          >
            <span className="md:hidden xl:inline">{item.label}</span>
            <span className="hidden md:inline xl:hidden">{item.shortLabel}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>로그인하면 예약 내역과 찜·일정을 볼 수 있어요</TooltipContent>
      </Tooltip>
    );
  }

  return (
    // active prop → Radix가 aria-current="page"를 붙인다 (명세 5.5 a11y)
    <NavigationMenuLink asChild active={active}>
      <Link
        href={item.href}
        className={cn(
          base,
          "rounded-none p-0 underline-offset-4 hover:bg-transparent hover:underline focus:bg-transparent",
          "data-active:bg-transparent data-active:font-semibold data-active:hover:bg-transparent data-active:hover:no-underline",
          transparent
            ? "text-white data-active:border-white"
            : "text-muted-foreground hover:text-foreground data-active:border-primary data-active:text-foreground",
        )}
      >
        <span className="md:hidden xl:inline">{item.label}</span>
        <span className="hidden md:inline xl:hidden">{item.shortLabel}</span>
      </Link>
    </NavigationMenuLink>
  );
}

function UserArea({
  user,
  isLoading,
  transparent,
}: {
  user: NavUser | null;
  isLoading: boolean;
  transparent: boolean;
}) {
  if (isLoading)
    return (
      <Skeleton
        role="status"
        aria-label="사용자 정보 불러오는 중"
        className="size-9 rounded-full"
      />
    );

  if (!user) {
    return (
      <Link
        href="/login"
        className={cn(
          "flex h-10 items-center rounded-full px-4.5 text-sm font-semibold transition-opacity duration-fast hover:opacity-90",
          transparent ? "bg-white text-stone-900" : "bg-foreground text-background",
        )}
      >
        로그인
      </Link>
    );
  }

  // 아바타 → 메뉴(나의 여행 / 로그아웃)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${user.name}님 계정 메뉴`} className="block rounded-full">
        <Avatar className="size-9">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback>{user.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {user.name}님
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/my">나의 여행</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={ROLE_LINK[user.role].href}>{ROLE_LINK[user.role].label}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          {/* 로그아웃은 Server Action — 폼 제출로 실행한다 */}
          <form action={signOut} className="w-full">
            <button type="submit" className="w-full text-left">
              로그아웃
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileMenu({
  user,
  pathname,
  transparent,
}: {
  user: NavUser | null;
  pathname: string;
  transparent: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/* Radix가 aria-expanded를 붙인다 (명세 5.5 a11y) */}
        <button
          type="button"
          aria-label="메뉴"
          className={cn(
            "grid size-11 place-items-center rounded-full md:hidden",
            transparent ? "hover:bg-white/10" : "hover:bg-muted",
          )}
        >
          <MenuIcon aria-hidden className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 gap-1 px-4 pt-14">
        <SheetTitle className="sr-only">메뉴</SheetTitle>
        <SheetDescription className="sr-only">사이트 메뉴</SheetDescription>
        <nav aria-label="모바일 메뉴" className="flex flex-col">
          <WithCategory>
            {(category) =>
              MENU.map((item) => {
                const active = item.isActive(pathname, category);
                const disabled = item.requiresAuth && !user;
                return disabled ? (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    className="py-2.5 text-base text-muted-foreground"
                  >
                    {item.label}
                    <span className="ml-2 text-xs">로그인 필요</span>
                  </span>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "py-2.5 text-base",
                      active ? "font-semibold text-primary" : "text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })
            }
          </WithCategory>
        </nav>
        {user && (
          <Link
            href={ROLE_LINK[user.role].href}
            onClick={() => setOpen(false)}
            className="mt-4 border-t pt-4 text-sm text-muted-foreground hover:text-foreground"
          >
            {ROLE_LINK[user.role].label}
          </Link>
        )}
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          {user ? (
            <form action={signOut} className="flex items-center gap-3 text-sm">
              <span className="font-medium">{user.name}님</span>
              <button type="submit" className="text-muted-foreground hover:underline">
                로그아웃
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground"
            >
              로그인 / 회원가입
            </Link>
          )}
          <ThemeToggle />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function IconButton({
  label,
  onClick,
  transparent,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  transparent: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid size-11 place-items-center rounded-full transition-colors duration-fast",
        transparent ? "hover:bg-white/10" : "hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

type TabKey = "home" | "explore" | "cart" | "my";

// 사용자 확정: 홈 · 탐색 · 장바구니 · 나의 여행 (찜·일정은 나의 여행 안의 탭)
const BOTTOM_TABS: { key: TabKey; href: string; label: string; icon: LucideIcon }[] = [
  { key: "home", href: "/", label: "홈", icon: HouseIcon },
  { key: "explore", href: "/products", label: "탐색", icon: CompassIcon },
  { key: "cart", href: "/cart", label: "장바구니", icon: ShoppingBagIcon },
  { key: "my", href: "/my", label: "나의 여행", icon: UserRoundIcon },
];

function activeTabOf(pathname: string): TabKey | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/products")) return "explore";
  if (pathname.startsWith("/cart") || pathname.startsWith("/checkout")) return "cart";
  if (pathname.startsWith("/my")) return "my";
  return null;
}

function BottomTabs({ pathname, cartCount }: { pathname: string; cartCount: number }) {
  const active = activeTabOf(pathname);

  return (
    <nav
      aria-label="하단 탭"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-16 grid-cols-4">
        {BOTTOM_TABS.map(({ key, href, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-xs",
                  isActive ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-5" />
                  {key === "cart" && cartCount > 0 && (
                    <CountBadge count={cartCount} className="-top-2 -right-3" />
                  )}
                </span>
                {label}
                {key === "cart" && cartCount > 0 && (
                  <span className="sr-only">, {cartCount}개 담김</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** 스크롤이 조금이라도 내려갔는지 — 히어로 위 투명 내비를 불투명으로 바꾸는 데 쓴다 */
function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}
