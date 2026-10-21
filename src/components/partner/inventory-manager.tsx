"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { setInventoryRange } from "@/actions/partner-products";
import { FormField } from "@/components/form/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  addDays,
  isoWeekday,
  MAX_DAYS_AHEAD,
  slotAvailability,
  type InventoryRow,
  type SlotRule,
} from "@/lib/booking";
import { formatKrw } from "@/lib/format";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

type Product = {
  adultPrice: number;
  childPrice: number | null;
  operatingDays: number[];
};

/** "YYYY-MM"의 달력 칸: 월요일 시작, 앞뒤 빈칸은 null */
function monthCells(ym: string) {
  const first = `${ym}-01`;
  const lead = isoWeekday(first) - 1;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; d.startsWith(ym); d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + n, 1));
  return date.toISOString().slice(0, 7);
};

/**
 * 파트너 재고 관리 (하이파이에 없는 화면 — 기존 토큰·컴포넌트로 구성)
 * - 달력: 고른 회차의 날짜별 남은 자리/정원, 덮어쓴 가격, 마감 표시. 날짜를 누르면 그날을 수정 대상으로
 * - 기간 수정: 기간 × 요일에 정원·마감·가격을 덮어쓰거나 기본값으로 되돌린다 (DB set_inventory_range, 한 트랜잭션)
 * 예약 인원보다 정원을 줄이면 DB가 거부한다(capacity_below_booked) — 그때는 기간 전체가 바뀌지 않는다.
 */
export function InventoryManager({
  product,
  slots,
  inventory,
  today,
}: {
  product: Product;
  slots: SlotRule[];
  inventory: InventoryRow[];
  today: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [capacity, setCapacity] = useState("");
  const [closed, setClosed] = useState(false);
  const [adultPrice, setAdultPrice] = useState("");
  const [childPrice, setChildPrice] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const slot = slots.find((s) => s.id === slotId);
  const last = addDays(today, MAX_DAYS_AHEAD);
  const cellOf = (date: string) => {
    if (!slot) return null;
    const row = inventory.find((i) => i.slotId === slot.id && i.useDate === date);
    return { row, availability: slotAvailability(product, slot, row) };
  };

  const pickDate = (date: string) => {
    setFrom(date);
    setTo(date);
    setWeekdays([]);
    const cell = cellOf(date);
    setCapacity(cell?.row?.capacity != null ? String(cell.row.capacity) : "");
    setClosed(cell?.row?.closed ?? false);
    setAdultPrice(cell?.row?.adultPrice != null ? String(cell.row.adultPrice) : "");
    setChildPrice(cell?.row?.childPrice != null ? String(cell.row.childPrice) : "");
    setMessage(null);
  };

  const submit = (mode: "set" | "reset") => {
    setMessage(null);
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    startTransition(async () => {
      const result = await setInventoryRange({
        slotId,
        from,
        to,
        weekdays,
        mode,
        capacity: num(capacity),
        closed,
        adultPrice: num(adultPrice),
        childPrice: product.childPrice === null ? null : num(childPrice),
      });
      if (!result.ok) {
        setMessage({ ok: false, text: result.message ?? "저장하지 못했어요. 다시 시도해 주세요." });
        return;
      }
      setMessage({
        ok: true,
        text:
          mode === "reset"
            ? `${result.days}일을 기본값으로 되돌렸어요.`
            : `${result.days}일의 재고를 바꿨어요.`,
      });
      // 서버에서 새 재고를 다시 받아 달력에 반영
      router.refresh();
    });
  };

  if (!slot) {
    return (
      <p className="text-sm text-muted-foreground">
        판매 중인 회차가 없어요. 상품 수정에서 회차를 추가해 주세요.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
      <section aria-labelledby={`${uid}-cal`} className="flex flex-col gap-4">
        {slots.length > 1 && (
          <div role="group" aria-label="회차" className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant={s.id === slotId ? "default" : "outline"}
                aria-pressed={s.id === slotId}
                className="h-10 rounded-full px-4"
                onClick={() => setSlotId(s.id)}
              >
                {s.startTime ?? "종일"} · 정원 {s.capacity}
              </Button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <h2 id={`${uid}-cal`} className="font-kr text-lg font-semibold">
            {month.replace("-", "년 ")}월 · {slot.startTime ?? "종일"} 회차
          </h2>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              aria-label="이전 달"
              disabled={month <= today.slice(0, 7)}
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeftIcon aria-hidden className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              aria-label="다음 달"
              disabled={month >= last.slice(0, 7)}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRightIcon aria-hidden className="size-4" />
            </Button>
          </div>
        </div>

        <div role="group" aria-labelledby={`${uid}-cal`} className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div key={w} aria-hidden className="py-1 text-center text-xs text-muted-foreground">
              {w}
            </div>
          ))}
          {monthCells(month).map((date, i) => {
            if (!date) return <div key={`e${i}`} aria-hidden />;
            const outOfRange = date < today || date > last;
            const operating = product.operatingDays.includes(isoWeekday(date));
            const cell = cellOf(date);
            const selected = date >= from && date <= to;
            const a = cell?.availability;
            const priceOverride = cell?.row?.adultPrice != null;
            return (
              <button
                key={date}
                type="button"
                aria-pressed={selected}
                disabled={outOfRange}
                onClick={() => pickDate(date)}
                aria-label={`${date} ${
                  !operating
                    ? "휴무일"
                    : a?.closed
                      ? "마감"
                      : `남은 자리 ${a?.remaining}석 / 정원 ${cell?.row?.capacity ?? slot.capacity}`
                }${priceOverride ? ` · 성인 ${formatKrw(a?.adultPrice ?? 0)}` : ""}`}
                className={cn(
                  "flex min-h-16 flex-col items-start gap-0.5 rounded-md border p-1.5 text-left text-xs transition-colors duration-fast md:min-h-20 md:p-2",
                  outOfRange &&
                    "cursor-not-allowed border-transparent text-muted-foreground opacity-50",
                  !outOfRange && "hover:bg-muted",
                  !operating && !outOfRange && "bg-muted text-muted-foreground",
                  selected && "border-primary ring-2 ring-primary/40",
                )}
              >
                <span className="font-semibold">{Number(date.slice(8))}</span>
                {!outOfRange &&
                  operating &&
                  (a?.closed ? (
                    <span className="font-semibold text-destructive">마감</span>
                  ) : (
                    <span
                      className={cn(
                        "tabular-nums",
                        a?.remaining === 0 && "font-semibold text-destructive",
                      )}
                    >
                      {a?.remaining === 0
                        ? "매진"
                        : `${a?.remaining}/${cell?.row?.capacity ?? slot.capacity}`}
                    </span>
                  ))}
                {!outOfRange && operating && priceOverride && (
                  <span className="hidden text-primary md:block">
                    {formatKrw(a?.adultPrice ?? 0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          칸의 숫자 = 남은 자리/정원 · 회색 = 운영하지 않는 요일 · 날짜를 누르면 오른쪽(아래)에서
          고칠 수 있어요.
        </p>
      </section>

      <section
        aria-labelledby={`${uid}-edit`}
        className="flex h-fit flex-col gap-4 rounded-xl border bg-card p-5 xl:sticky xl:top-6"
      >
        <h2 id={`${uid}-edit`} className="font-kr text-lg font-semibold">
          기간 수정
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <FormField id={`${uid}-from`} label="시작일">
            <Input
              id={`${uid}-from`}
              type="date"
              value={from}
              min={today}
              max={last}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11"
            />
          </FormField>
          <FormField id={`${uid}-to`} label="종료일">
            <Input
              id={`${uid}-to`}
              type="date"
              value={to}
              min={from}
              max={last}
              onChange={(e) => setTo(e.target.value)}
              className="h-11"
            />
          </FormField>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">요일 (비우면 모든 요일)</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((label, i) => {
              const day = i + 1;
              const on = weekdays.includes(day);
              return (
                <label
                  key={label}
                  className={cn(
                    "grid size-10 cursor-pointer place-items-center rounded-full border text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    on ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() =>
                      setWeekdays(on ? weekdays.filter((d) => d !== day) : [...weekdays, day])
                    }
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <FormField
          id={`${uid}-cap`}
          label="정원"
          hint={`비우면 회차 기본 정원(${slot.capacity}명)`}
        >
          <Input
            id={`${uid}-cap`}
            inputMode="numeric"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="h-11"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            id={`${uid}-adult`}
            label="성인 가격"
            hint={`비우면 ${formatKrw(product.adultPrice)}`}
          >
            <Input
              id={`${uid}-adult`}
              inputMode="numeric"
              value={adultPrice}
              onChange={(e) => setAdultPrice(e.target.value)}
              className="h-11"
            />
          </FormField>
          {product.childPrice !== null && (
            <FormField
              id={`${uid}-child`}
              label="아동 가격"
              hint={`비우면 ${formatKrw(product.childPrice)}`}
            >
              <Input
                id={`${uid}-child`}
                inputMode="numeric"
                value={childPrice}
                onChange={(e) => setChildPrice(e.target.value)}
                className="h-11"
              />
            </FormField>
          )}
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <Checkbox checked={closed} onCheckedChange={(on) => setClosed(on === true)} />이 기간 판매
          마감
        </label>

        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={cn("text-sm", message.ok ? "text-foreground" : "text-destructive")}
          >
            {message.text}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="h-11 rounded-md font-semibold"
            disabled={pending}
            onClick={() => submit("set")}
          >
            {pending ? "저장하는 중…" : "이 기간에 적용"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-md"
            disabled={pending}
            onClick={() => submit("reset")}
          >
            기본값으로 되돌리기
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          적용하면 이 기간의 덮어쓴 값이 모두 위 값으로 바뀌어요. 예약된 인원보다 정원을 줄일 수는
          없어요.
        </p>
      </section>
    </div>
  );
}
