import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "cn";

/**
 * 콘솔 목록 공용 조각 — 서버 컴포넌트라 JS 없이도 동작한다 (필터는 GET 폼 → URL 쿼리).
 * - FilterChips: 상태 칩 (링크)
 * - NativeSelect: 입력창과 같은 모양의 select (GET 폼에 값이 그대로 실린다)
 * - ListPagination: 이전/다음 + "n–m / 총 N건"
 */

export function FilterChips({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          scroll={false}
          aria-current={c.active ? "page" : undefined}
          className={cn(
            "flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-medium transition-colors duration-fast hover:bg-muted",
            c.active && "border-foreground bg-foreground text-background hover:bg-foreground",
          )}
        >
          {c.label}
        </Link>
      ))}
    </nav>
  );
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-stone-500 bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

export function ListPagination({
  page,
  pageSize,
  total,
  hrefOf,
  label,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefOf: (page: number) => string;
  label: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const last = Math.max(1, Math.ceil(total / pageSize));
  const linkClass =
    "inline-flex h-10 items-center gap-1 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted";
  const disabledClass =
    "inline-flex h-10 items-center gap-1 rounded-md border border-input px-3 text-sm text-muted-foreground opacity-60";

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} / 총 {total.toLocaleString()}건
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefOf(page - 1)} scroll={false} className={linkClass}>
            <ChevronLeftIcon aria-hidden className="size-4" />
            이전
          </Link>
        ) : (
          <span aria-disabled className={disabledClass}>
            <ChevronLeftIcon aria-hidden className="size-4" />
            이전
          </span>
        )}
        {page < last ? (
          <Link href={hrefOf(page + 1)} scroll={false} className={linkClass}>
            다음
            <ChevronRightIcon aria-hidden className="size-4" />
          </Link>
        ) : (
          <span aria-disabled className={disabledClass}>
            다음
            <ChevronRightIcon aria-hidden className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
