"use client";

import { ShoppingBagIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { removeCartItems, updateCartQuantity } from "@/actions/cart";
import { QuantityStepper } from "@/components/product/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { CartItem } from "@/lib/data/cart";
import { formatKrw, formatUseDate } from "@/lib/format";
import { bookingErrorLabel } from "@/lib/booking";
import { errorMessage } from "@/lib/order-errors";
import { cn } from "@/lib/utils";

/**
 * 장바구니 (하이파이에 없는 쇼핑몰 화면 — 기존 토큰·컴포넌트로 구성, 사용자 확정)
 * - 1024 이상: 목록 8칸 + 결제 요약 4칸(sticky)
 * - 1023 이하: 목록 + 하단 고정 바(총액 · 주문하기)
 * - 예약할 수 없게 된 항목(마감·휴무·판매 중지)은 표시만 하고 선택·주문할 수 없다
 * - 금액은 상품의 현재 가격 (장바구니에는 가격을 저장하지 않는다). 결제 금액은 주문 시 DB가 다시 계산한다
 */
export function CartView({
  items,
  preview = false,
}: {
  items: CartItem[];
  // 디자인 QA 전용(/dev/components): 하단 고정 바를 화면에 띄우지 않고 제자리에 그린다
  preview?: boolean;
}) {
  const router = useRouter();
  const orderable = items.filter((i) => !i.error);
  // 처음에는 주문 가능한 항목을 모두 선택한다
  const [selected, setSelected] = useState<string[]>(() => orderable.map((i) => i.id));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 서버에서 항목이 사라졌으면(삭제·주문) 선택에서도 뺀다
  const selectedItems = orderable.filter((i) => selected.includes(i.id));
  const total = selectedItems.reduce((sum, i) => sum + i.subtotal, 0);
  const allSelected = orderable.length > 0 && selectedItems.length === orderable.length;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

  const run = (task: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) setError(result.message ?? errorMessage(null));
    });
  };

  const checkout = () => {
    if (selectedItems.length === 0) return;
    router.push(`/checkout?items=${selectedItems.map((i) => i.id).join(",")}`);
  };

  if (items.length === 0) return <CartEmpty />;

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
      <section aria-label="담은 상품" className="flex flex-col gap-4 lg:col-span-8">
        <div className="flex items-center justify-between gap-4 border-b pb-3">
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <Checkbox
              checked={allSelected}
              disabled={orderable.length === 0}
              onCheckedChange={(on) => setSelected(on === true ? orderable.map((i) => i.id) : [])}
            />
            전체 선택 ({selectedItems.length}/{orderable.length})
          </label>
          <button
            type="button"
            disabled={selectedItems.length === 0 || pending}
            onClick={() => run(() => removeCartItems(selectedItems.map((i) => i.id)))}
            className="h-10 px-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
          >
            선택 삭제
          </button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <ul className="flex flex-col gap-4" aria-busy={pending || undefined}>
          {items.map((item) => (
            <CartRow
              key={item.id}
              item={item}
              checked={selected.includes(item.id) && !item.error}
              onCheckedChange={(on) => toggle(item.id, on)}
              pending={pending}
              onQuantity={(adultQty, childQty) =>
                run(() => updateCartQuantity(item.id, { adultQty, childQty }))
              }
              onRemove={() => run(() => removeCartItems([item.id]))}
            />
          ))}
        </ul>
      </section>

      {/* 결제 요약: 1024 이상 사이드 sticky */}
      <aside aria-label="결제 요약" className="hidden lg:col-span-4 lg:block">
        <div className="sticky top-24 flex flex-col gap-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">결제 예정 금액</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">선택한 상품</dt>
              <dd>{selectedItems.length}개</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">상품 금액</dt>
              <dd>{formatKrw(total)}</dd>
            </div>
          </dl>
          <div className="flex items-baseline justify-between border-t pt-4">
            <span className="font-medium">총 결제 금액</span>
            <span className="text-2xl font-semibold" aria-live="polite">
              {formatKrw(total)}
            </span>
          </div>
          <Button
            className="h-12 rounded-md text-base font-semibold"
            disabled={selectedItems.length === 0 || pending}
            onClick={checkout}
          >
            {selectedItems.length > 0
              ? `${selectedItems.length}개 상품 주문하기`
              : "주문할 상품을 골라 주세요"}
          </Button>
          <p className="text-xs text-muted-foreground">
            금액은 현재 판매 가격 기준이에요. 결제 직전에 한 번 더 확인해요.
          </p>
        </div>
      </aside>

      {/* 1023 이하: 하단 고정 주문 바 (360에서는 하단 탭 위) */}
      <div
        className={cn(
          "border-t bg-background/95 backdrop-blur lg:hidden",
          preview
            ? "static"
            : "fixed inset-x-0 bottom-[calc(--spacing(16)+env(safe-area-inset-bottom))] z-20 md:bottom-0 md:pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <div className="container flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">선택 {selectedItems.length}개</p>
            <p className="text-lg font-semibold">{formatKrw(total)}</p>
          </div>
          <Button
            className="h-12 shrink-0 rounded-md px-6 text-base font-semibold"
            disabled={selectedItems.length === 0 || pending}
            onClick={checkout}
          >
            주문하기
          </Button>
        </div>
      </div>
    </div>
  );
}

function CartRow({
  item,
  checked,
  onCheckedChange,
  pending,
  onQuantity,
  onRemove,
}: {
  item: CartItem;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
  pending: boolean;
  onQuantity: (adult: number, child: number) => void;
  onRemove: () => void;
}) {
  const { product: p } = item;
  const unavailable = Boolean(item.error);
  const remaining = p.maxQty - item.adultQty - item.childQty;

  return (
    // 360에서도 넘치지 않게: 윗줄(선택·사진·정보·삭제) / 아랫줄(인원·금액)로 나눈다
    <li
      className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4", unavailable && "bg-muted")}
    >
      <div className="flex gap-3 md:gap-4">
        <Checkbox
          checked={checked}
          disabled={unavailable}
          onCheckedChange={(on) => onCheckedChange(on === true)}
          aria-label={`${p.title} 선택`}
          className="mt-1"
        />
        <Link
          href={`/products/${p.slug}`}
          className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted md:size-20"
          tabIndex={-1}
          aria-hidden
        >
          <Image
            src={p.imageUrl}
            alt=""
            fill
            sizes="80px"
            className={cn("object-cover", unavailable && "opacity-55 grayscale")}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{p.cityName}</p>
          <h3 className="font-kr text-base font-semibold">
            <Link href={`/products/${p.slug}`} className="underline-offset-3 hover:underline">
              {p.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm">
            {formatUseDate(item.useDate)}
            {p.startTime && <span className="text-muted-foreground"> · {p.startTime} 시작</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          aria-label={`${p.title} 삭제`}
          className="grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:pl-8">
        {unavailable && item.error ? (
          <p className="inline-flex items-center gap-1.5 self-start rounded-sm border border-warning/40 bg-card px-2 py-1 text-xs font-semibold text-warning">
            <TriangleAlertIcon aria-hidden className="size-3.5 shrink-0" />
            {bookingErrorLabel(item.error)} · 삭제하고 다시 담아 주세요
          </p>
        ) : (
          <div className="flex flex-col gap-2 md:w-72">
            <QuantityStepper
              label="성인"
              description={formatKrw(p.adultPrice)}
              value={item.adultQty}
              max={item.adultQty + remaining}
              // 인원 합계는 1명 이상이어야 한다 (DB CHECK)
              min={item.childQty > 0 ? 0 : 1}
              disabled={pending}
              onChange={(n) => onQuantity(n, item.childQty)}
            />
            {p.childPrice !== null && (
              <QuantityStepper
                label="아동"
                description={formatKrw(p.childPrice)}
                value={item.childQty}
                max={item.childQty + remaining}
                min={item.adultQty > 0 ? 0 : 1}
                disabled={pending}
                onChange={(n) => onQuantity(item.adultQty, n)}
              />
            )}
          </div>
        )}
        <p className="text-right text-base font-semibold">{formatKrw(item.subtotal)}</p>
      </div>
    </li>
  );
}

function CartEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-[1.5px] border-dashed border-input px-6 py-20 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted">
        <ShoppingBagIcon aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <p className="font-kr text-2xl font-semibold">장바구니가 비어 있어요</p>
      <p className="text-base text-muted-foreground">마음에 드는 투어나 티켓을 담아 보세요.</p>
      <Button asChild className="mt-2 h-11 rounded-md px-5 text-base font-semibold">
        <Link href="/products">상품 둘러보기</Link>
      </Button>
    </div>
  );
}
