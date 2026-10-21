"use client";

import { CalendarCheckIcon, CheckCircle2Icon, ClockIcon, HourglassIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ko } from "react-day-picker/locale/ko";

import { addToCart } from "@/actions/cart";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
  cutoffLabel,
  dateError,
  isSoldOutOn,
  lineTotal,
  MAX_DAYS_AHEAD,
  operatingDaysLabel,
  optionPriceLabel,
  optionsAmount,
  slotError,
  slotsOn,
  type BookingRules,
  type InventoryRow,
  type OptionRule,
  type SlotRule,
} from "@/lib/booking";
import type { ConfirmationMode } from "@/lib/constants/taxonomy";
import { discountRate, formatKrw, formatUseDate } from "@/lib/format";
import { errorMessage } from "@/lib/order-errors";
import { cn } from "@/lib/utils";

import { QuantityStepper } from "./quantity-stepper";

export type BookingProduct = BookingRules & {
  id: string;
  slug: string;
  title: string;
  listAdultPrice: number | null;
  durationText: string;
  confirmationMode: ConfirmationMode;
  slots: SlotRule[];
  options: OptionRule[];
  inventory: InventoryRow[]; // 예약 가능 기간의 날짜별 재고 (덮어쓴 정원·가격·마감, 예약 인원)
};

/** 날짜를 고를 수 없는 이유: 운영 규칙(요일·마감·기간) 또는 그날 모든 회차 매진·마감 */
const blockedOn = (product: BookingProduct, ymd: string, today: string) =>
  dateError(product, ymd, today) !== null ||
  isSoldOutOn(product, product.slots, product.inventory, ymd);

/** 예약 가능한 가장 빠른 날짜 (매진 포함) — 달력의 첫 달 */
function firstOpenDate(product: BookingProduct, today: string) {
  for (let i = 0; i <= MAX_DAYS_AHEAD; i += 1) {
    const ymd = addDays(today, i);
    if (!blockedOn(product, ymd, today)) return ymd;
  }
  return null;
}

/**
 * 날짜가 바뀌면 회차를 다시 고른다: 지금 회차가 그날도 예약 가능하면 그대로, 아니면 그날 첫 예약 가능 회차.
 * (회차가 하나뿐인 상품은 고를 필요가 없게 자동 선택)
 */
export function pickSlot(product: BookingProduct, date: string | null, current: string | null) {
  if (!date) return null;
  const open = slotsOn(product, product.slots, product.inventory, date).filter(
    ({ availability }) => !availability.closed && availability.remaining > 0,
  );
  return open.find((o) => o.slot.id === current)?.slot.id ?? open[0]?.slot.id ?? null;
}

/** 위젯 계산 (위젯·쇼케이스가 같이 쓴다): 그날 회차들, 고른 회차의 조건, 옵션 금액, 총액 */
export function quoteBooking(
  product: BookingProduct,
  date: string | null,
  slotId: string | null,
  adult: number,
  child: number,
  optionIds: string[],
) {
  const daySlots = date ? slotsOn(product, product.slots, product.inventory, date) : [];
  const selected = daySlots.find((d) => d.slot.id === slotId)?.availability ?? null;
  const prices = selected ?? { adultPrice: product.adultPrice, childPrice: product.childPrice };
  const optionTotal = optionsAmount(product.options, optionIds, adult + child);
  return {
    daySlots,
    selected,
    prices,
    optionTotal,
    total: lineTotal(prices, adult, child, optionTotal),
  };
}

/** 담기 전 화면 검사 (DB booking_error와 같은 순서). 통과하면 null */
export function bookingCheck(
  product: BookingProduct,
  today: string,
  date: string | null,
  slotId: string | null,
  adult: number,
  child: number,
) {
  if (!date) return "이용일을 선택해 주세요.";
  const code = bookingError(product, date, adult, child, today);
  if (code) return errorMessage(code);
  const { selected } = quoteBooking(product, date, slotId, adult, child, []);
  if (!slotId || !selected) return "회차를 선택해 주세요.";
  const slotCode = slotError(selected, adult + child);
  return slotCode ? errorMessage(slotCode) : null;
}

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
    initialDate && !blockedOn(product, initialDate, today) ? initialDate : null,
  );
  const [slotId, setSlotId] = useState<string | null>(() => pickSlot(product, date, null));
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [adult, setAdult] = useState(1);
  const [child, setChild] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { total } = quoteBooking(product, date, slotId, adult, child, optionIds);
  const unavailable = Boolean(product.unavailableReason);

  const submit = (mode: "cart" | "buy") => {
    setError(null);
    setAdded(false);
    const problem = bookingCheck(product, today, date, slotId, adult, child);
    if (problem || !date || !slotId) return setError(problem ?? "이용일을 선택해 주세요.");
    if (!isLoggedIn) {
      // 로그인 후 같은 날짜가 선택된 채로 돌아오게 한다
      router.push(`/login?next=${encodeURIComponent(`/products/${product.slug}?date=${date}`)}`);
      return;
    }

    startTransition(async () => {
      const input = {
        productId: product.id,
        slotId,
        useDate: date,
        adultQty: adult,
        childQty: child,
        optionIds,
      };
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
        setSlotId(pickSlot(product, next, slotId));
        setAdded(false);
        setError(null);
      }}
      slotId={slotId}
      onSlotChange={(next) => {
        setSlotId(next);
        setAdded(false);
        setError(null);
      }}
      optionIds={optionIds}
      onOptionsChange={(next) => {
        setOptionIds(next);
        setAdded(false);
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
                  이용일·회차·인원·옵션을 고르고 장바구니에 담거나 바로 구매하세요.
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
  slotId: string | null;
  onSlotChange: (slotId: string) => void;
  optionIds: string[];
  onOptionsChange: (optionIds: string[]) => void;
  adult: number;
  child: number;
  onAdultChange: (n: number) => void;
  onChildChange: (n: number) => void;
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
  slotId,
  onSlotChange,
  optionIds,
  onOptionsChange,
  adult,
  child,
  onAdultChange,
  onChildChange,
  error,
  added,
  pending,
  onSubmit,
  className,
}: BookingPanelProps) {
  const discount = discountRate(product.adultPrice, product.listAdultPrice);
  const unavailable = Boolean(product.unavailableReason);
  const first = firstOpenDate(product, today);
  const { daySlots, selected, prices, optionTotal, total } = quoteBooking(
    product,
    date,
    slotId,
    adult,
    child,
    optionIds,
  );
  // 더 고를 수 있는 인원: 상품 최대 인원과 고른 회차의 남은 자리 중 작은 쪽
  const limit = Math.min(product.maxQty, selected?.remaining ?? product.maxQty);
  const remaining = Math.max(limit - adult - child, 0);
  const slotTimes = product.slots.flatMap((sl) => (sl.startTime ? [sl.startTime] : []));
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
              // 운영하지 않는 요일·마감 지난 날·180일 이후·모든 회차 매진은 고를 수 없다 (DB booking_error와 같은 규칙)
              disabled={(d) => blockedOn(product, toYmd(d), today)}
              // 매진인 날은 휴무와 구분되게 취소선 (아래 안내 문구와 함께)
              modifiers={{
                soldOut: (d) =>
                  dateError(product, toYmd(d), today) === null &&
                  isSoldOutOn(product, product.slots, product.inventory, toYmd(d)),
              }}
              modifiersClassNames={{ soldOut: "[&_button]:line-through" }}
              className="w-full rounded-md border p-2 [--cell-size:--spacing(10)]"
            />
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarCheckIcon aria-hidden className="size-3.5" />
                {operatingDaysLabel(product.operatingDays)} · {cutoffLabel(product.cutoffDays)}
              </span>
              <span className="inline-flex items-center gap-1">
                <ClockIcon aria-hidden className="size-3.5" />
                {slotTimes.length > 0 ? `${slotTimes.join(" · ")} 시작 · ` : ""}
                {product.durationText}
              </span>
              <span>날짜 취소선 = 매진</span>
            </p>
          </section>

          {date && product.slots.length > 1 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-base font-semibold">회차</legend>
              <div className="grid grid-cols-2 gap-2">
                {daySlots.map(({ slot, availability }) => {
                  const soldOut = availability.closed || availability.remaining === 0;
                  const checked = slot.id === slotId;
                  return (
                    // 라디오는 화면에서 숨기고 라벨 전체를 버튼처럼 보이게 한다 (키보드·스크린리더는 라디오 그대로)
                    <label
                      key={slot.id}
                      className={cn(
                        "flex cursor-pointer flex-col rounded-md border-[1.5px] px-3 py-2 text-sm transition-colors duration-fast has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        checked
                          ? "border-primary bg-accent text-accent-foreground"
                          : "hover:bg-muted",
                        soldOut &&
                          "cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${uid}-slot`}
                        value={slot.id}
                        checked={checked}
                        disabled={soldOut}
                        onChange={() => onSlotChange(slot.id)}
                        className="sr-only"
                      />
                      <span className="font-semibold">{slot.startTime ?? "종일"}</span>
                      <span className="text-xs">
                        {availability.closed
                          ? "마감"
                          : availability.remaining === 0
                            ? "매진"
                            : `남은 자리 ${availability.remaining}석`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          {date && product.slots.length === 1 && selected && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              남은 자리 {selected.remaining}석
            </p>
          )}

          <section aria-labelledby={`${uid}-qty`} className="flex flex-col gap-3">
            <h2 id={`${uid}-qty`} className="text-base font-semibold">
              인원{" "}
              <span className="text-sm font-normal text-muted-foreground">
                최대 {product.maxQty}명
              </span>
            </h2>
            <QuantityStepper
              label="성인"
              description={formatKrw(prices.adultPrice)}
              value={adult}
              max={adult + remaining}
              onChange={onAdultChange}
            />
            {prices.childPrice !== null && (
              <QuantityStepper
                label="아동"
                description={formatKrw(prices.childPrice)}
                value={child}
                max={child + remaining}
                onChange={onChildChange}
              />
            )}
          </section>

          {product.options.length > 0 && (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2 text-base font-semibold">
                추가 옵션 <span className="text-sm font-normal text-muted-foreground">선택</span>
              </legend>
              {product.options.map((o) => (
                <label key={o.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2.5">
                    <Checkbox
                      checked={optionIds.includes(o.id)}
                      onCheckedChange={(on) =>
                        onOptionsChange(
                          on === true
                            ? [...optionIds, o.id]
                            : optionIds.filter((id) => id !== o.id),
                        )
                      }
                    />
                    {o.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{optionPriceLabel(o)}</span>
                </label>
              ))}
            </fieldset>
          )}

          {product.confirmationMode === "manual" && (
            <p className="flex gap-2 rounded-md border bg-card p-3 text-sm">
              <HourglassIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="font-semibold">파트너 확정 상품</span>이에요. 결제 후 최대 48시간
                안에 확정되고, 확정되지 않으면 전액 환불돼요.
              </span>
            </p>
          )}

          <div className="flex items-baseline justify-between border-t pt-4">
            <span className="text-base font-medium">
              총 금액
              {optionTotal > 0 && (
                <span className="block text-xs font-normal text-muted-foreground">
                  옵션 {formatKrw(optionTotal)} 포함
                </span>
              )}
            </span>
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
