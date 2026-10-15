"use client";

import { CalendarCheckIcon, CheckCircle2Icon, ClockIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ko } from "react-day-picker/locale/ko";

import { addToCart } from "@/actions/cart";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  addDays,
  bookingError,
  bookingTotal,
  cutoffLabel,
  dateError,
  firstAvailableDate,
  MAX_DAYS_AHEAD,
  operatingDaysLabel,
  type BookingRules,
} from "@/lib/booking";
import { discountRate, formatKrw, formatUseDate } from "@/lib/format";
import { errorMessage } from "@/lib/order-errors";
import { cn } from "@/lib/utils";

import { QuantityStepper } from "./quantity-stepper";

export type BookingProduct = BookingRules & {
  id: string;
  slug: string;
  title: string;
  listAdultPrice: number | null;
  startTime: string | null;
  durationText: string;
};

type BookingWidgetProps = {
  product: BookingProduct;
  today: string; // 서버가 계산한 한국 날짜 — 브라우저에서 따로 계산하면 서버 HTML과 달라질 수 있다
  initialDate: string | null; // 목록의 이용일 필터에서 넘어온 날짜 (?date=)
  isLoggedIn: boolean;
  // 1023 이하 하단 바에 함께 둘 버튼 (찜·공유)
  mobileActions?: React.ReactNode;
};

/** "YYYY-MM-DD" ↔ 달력의 Date(브라우저 현지 자정). 달력 칸만 다루므로 시간대 계산이 필요 없다 */
const toDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
const toYmd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * 예약 위젯 (상세 사이드 · 하이파이에 없는 쇼핑몰 화면이라 기존 토큰·컴포넌트로 구성)
 * - 1024 이상: 사이드 4칸에 고정(sticky)된 카드
 * - 1023 이하: 하단 고정 바(총액 · 예약하기) → 하단 시트에 같은 내용
 * 날짜·인원 규칙은 src/lib/booking.ts(화면용)로 미리 막고, 최종 판단은 DB 트리거가 한다.
 */
export function BookingWidget({
  product,
  today,
  initialDate,
  isLoggedIn,
  mobileActions,
}: BookingWidgetProps) {
  const router = useRouter();
  const [date, setDate] = useState<string | null>(
    initialDate && !dateError(product, initialDate, today) ? initialDate : null,
  );
  const [adult, setAdult] = useState(1);
  const [child, setChild] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  const total = bookingTotal(product, adult, child);
  const unavailable = Boolean(product.unavailableReason);

  const submit = (mode: "cart" | "buy") => {
    setError(null);
    setAdded(false);
    if (!date) return setError("이용일을 선택해 주세요.");
    const code = bookingError(product, date, adult, child, today);
    if (code) return setError(errorMessage(code));
    if (!isLoggedIn) {
      // 로그인 후 같은 날짜가 선택된 채로 돌아오게 한다
      router.push(`/login?next=${encodeURIComponent(`/products/${product.slug}?date=${date}`)}`);
      return;
    }

    startTransition(async () => {
      const input = { productId: product.id, useDate: date, adultQty: adult, childQty: child };
      const result = await addToCart(input, mode === "buy" ? "set" : "add");
      if (!result.ok) {
        if (result.reason === "unauthenticated") return router.push("/login");
        return setError(result.message ?? errorMessage(null));
      }
      if (mode === "buy") return router.push(`/checkout?items=${result.cartItemId}`);
      setAdded(true);
    });
  };

  // 데스크톱은 카드 테두리로, 시트 안에서는 시트가 이미 틀이므로 테두리 없이 그린다
  const panel = (className?: string) => (
    <BookingPanel
      className={className}
      product={product}
      today={today}
      date={date}
      onDateChange={(next) => {
        setDate(next);
        setAdded(false);
        setError(null);
      }}
      adult={adult}
      child={child}
      onAdultChange={(n) => {
        setAdult(n);
        setAdded(false);
      }}
      onChildChange={(n) => {
        setChild(n);
        setAdded(false);
      }}
      total={total}
      error={error}
      added={added}
      pending={pending}
      onSubmit={submit}
    />
  );

  return (
    <>
      {/* 1024 이상: 사이드 카드 */}
      <div className="hidden lg:block">{panel()}</div>

      {/* 1023 이하: 하단 고정 바 (360에서는 하단 탭 위에 놓인다) → 하단 시트 */}
      <div className="fixed inset-x-0 bottom-[calc(--spacing(16)+env(safe-area-inset-bottom))] z-20 border-t bg-background/95 backdrop-blur md:bottom-0 md:pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="container flex items-center gap-2 py-3">
          {mobileActions}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {date ? `${formatUseDate(date)} · ${adult + child}명` : "성인 1인"}
            </p>
            <p className="truncate text-lg font-semibold">
              {formatKrw(date ? total : product.adultPrice)}
            </p>
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                className="h-12 shrink-0 rounded-md px-6 text-base font-semibold"
                disabled={unavailable}
              >
                {unavailable ? "판매 중지" : "예약하기"}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-xl pb-[env(safe-area-inset-bottom)]"
            >
              <SheetHeader>
                <SheetTitle className="text-lg">예약하기</SheetTitle>
                <SheetDescription className="sr-only">
                  이용일과 인원을 고르고 장바구니에 담거나 바로 구매하세요.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4">{panel("border-0 bg-transparent p-0")}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}

type BookingPanelProps = {
  product: BookingProduct;
  today: string;
  date: string | null;
  onDateChange: (date: string | null) => void;
  adult: number;
  child: number;
  onAdultChange: (n: number) => void;
  onChildChange: (n: number) => void;
  total: number;
  error: string | null;
  added: boolean;
  pending: boolean;
  onSubmit: (mode: "cart" | "buy") => void;
  className?: string;
};

/** 위젯 본문 — 데스크톱 카드와 모바일 시트가 같은 내용을 쓴다 (/dev/components에서도 단독으로 보여준다) */
export function BookingPanel({
  product,
  today,
  date,
  onDateChange,
  adult,
  child,
  onAdultChange,
  onChildChange,
  total,
  error,
  added,
  pending,
  onSubmit,
  className,
}: BookingPanelProps) {
  const discount = discountRate(product.adultPrice, product.listAdultPrice);
  const unavailable = Boolean(product.unavailableReason);
  const first = firstAvailableDate(product, today);
  const remaining = product.maxQty - adult - child; // 더 고를 수 있는 인원
  // 데스크톱 카드와 모바일 시트가 동시에 DOM에 있을 수 있어 제목 id를 인스턴스마다 다르게 만든다
  const uid = useId();

  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-xl border bg-card p-5 text-card-foreground",
        className,
      )}
    >
      <div>
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          {discount !== null && (
            <span className="text-lg font-semibold text-destructive">
              {discount}%<span className="sr-only"> 할인</span>
            </span>
          )}
          <span className="text-2xl font-semibold">{formatKrw(product.adultPrice)}</span>
          {product.listAdultPrice && (
            <s className="text-sm text-muted-foreground">
              <span className="sr-only">정가 </span>
              {formatKrw(product.listAdultPrice)}
            </s>
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          성인 1인 기준
          {product.childPrice !== null
            ? ` · 아동 ${formatKrw(product.childPrice)}`
            : " · 성인 전용 상품"}
        </p>
      </div>

      {unavailable ? (
        <p className="rounded-md bg-muted px-4 py-3 text-sm font-medium">
          {product.unavailableReason}
        </p>
      ) : (
        <>
          <section aria-labelledby={`${uid}-date`} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id={`${uid}-date`} className="text-base font-semibold">
                이용일
              </h2>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {date ? formatUseDate(date) : "날짜를 골라 주세요"}
              </p>
            </div>
            <Calendar
              mode="single"
              locale={ko}
              selected={date ? toDate(date) : undefined}
              onSelect={(d) => onDateChange(d ? toYmd(d) : null)}
              defaultMonth={toDate(date ?? first ?? today)}
              startMonth={toDate(today)}
              endMonth={toDate(addDays(today, MAX_DAYS_AHEAD))}
              // 운영하지 않는 요일·마감 지난 날·180일 이후는 고를 수 없다 (DB booking_error와 같은 규칙)
              disabled={(d) => dateError(product, toYmd(d), today) !== null}
              className="w-full rounded-md border p-2 [--cell-size:--spacing(10)]"
            />
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarCheckIcon aria-hidden className="size-3.5" />
                {operatingDaysLabel(product.operatingDays)} · {cutoffLabel(product.cutoffDays)}
              </span>
              <span className="inline-flex items-center gap-1">
                <ClockIcon aria-hidden className="size-3.5" />
                {product.startTime ? `${product.startTime} 시작 · ` : ""}
                {product.durationText}
              </span>
            </p>
          </section>

          <section aria-labelledby={`${uid}-qty`} className="flex flex-col gap-3">
            <h2 id={`${uid}-qty`} className="text-base font-semibold">
              인원{" "}
              <span className="text-sm font-normal text-muted-foreground">
                최대 {product.maxQty}명
              </span>
            </h2>
            <QuantityStepper
              label="성인"
              description={formatKrw(product.adultPrice)}
              value={adult}
              max={adult + remaining}
              onChange={onAdultChange}
            />
            {product.childPrice !== null && (
              <QuantityStepper
                label="아동"
                description={formatKrw(product.childPrice)}
                value={child}
                max={child + remaining}
                onChange={onChildChange}
              />
            )}
          </section>

          <div className="flex items-baseline justify-between border-t pt-4">
            <span className="text-base font-medium">총 금액</span>
            <span className="text-2xl font-semibold" aria-live="polite">
              {formatKrw(total)}
            </span>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {added && (
            <p
              role="status"
              className="flex items-center justify-between gap-2 rounded-md bg-accent px-3 py-2.5 text-sm text-accent-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2Icon aria-hidden className="size-4" />
                장바구니에 담았어요
              </span>
              <Link href="/cart" className="font-semibold underline-offset-3 hover:underline">
                장바구니 보기 →
              </Link>
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-md text-base font-semibold"
              disabled={pending}
              onClick={() => onSubmit("cart")}
            >
              장바구니 담기
            </Button>
            <Button
              type="button"
              className="h-12 rounded-md text-base font-semibold"
              disabled={pending}
              onClick={() => onSubmit("buy")}
            >
              {pending ? "처리 중…" : "바로 구매"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
