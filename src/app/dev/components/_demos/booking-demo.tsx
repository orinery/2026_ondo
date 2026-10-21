"use client";

import { useMemo, useState } from "react";

import {
  BookingPanel,
  bookingCheck,
  pickSlot,
  type BookingProduct,
} from "@/components/product/booking-widget";
import { addDays, isoWeekday } from "@/lib/booking";
import { errorMessage } from "@/lib/order-errors";

/** 오늘부터 n일 뒤 중 수요일(휴무)이 아닌 첫 날 — 데모 재고를 운영일에 놓기 위해 */
function openDay(today: string, from: number) {
  for (let i = from; i < from + 7; i += 1) {
    const d = addDays(today, i);
    if (isoWeekday(d) !== 3) return d;
  }
  return addDays(today, from);
}

function demoProduct(today: string): BookingProduct {
  const soldOutDay = openDay(today, 4); // 두 회차 모두 매진 → 달력 취소선
  const closedDay = openDay(today, 6); // 10:00 마감, 14:00 남은 2석
  return {
    id: "demo",
    slug: "kyoto-machiya-tea-ceremony",
    title: "교토 마치야 다도 체험",
    adultPrice: 38000,
    childPrice: 25000,
    listAdultPrice: 42000,
    operatingDays: [1, 2, 4, 5, 6, 7], // 수요일 휴무 → 달력에서 비활성
    cutoffDays: 2,
    maxQty: 6,
    unavailableReason: null,
    durationText: "약 1시간",
    confirmationMode: "manual",
    slots: [
      { id: "slot-10", startTime: "10:00", capacity: 8 },
      { id: "slot-14", startTime: "14:00", capacity: 8 },
    ],
    options: [
      { id: "opt-sweets", name: "화과자 세트 추가", price: 8000, unit: "per_person" },
      { id: "opt-pickup", name: "숙소 픽업", price: 10000, unit: "per_booking" },
    ],
    inventory: [
      {
        slotId: "slot-10",
        useDate: soldOutDay,
        capacity: null,
        closed: false,
        adultPrice: null,
        childPrice: null,
        booked: 8,
      },
      {
        slotId: "slot-14",
        useDate: soldOutDay,
        capacity: null,
        closed: false,
        adultPrice: null,
        childPrice: null,
        booked: 8,
      },
      {
        slotId: "slot-10",
        useDate: closedDay,
        capacity: null,
        closed: true,
        adultPrice: null,
        childPrice: null,
        booked: 0,
      },
      // 이 날 14:00은 가격도 덮어써서(42,000원) 날짜별 가격을 보여준다
      {
        slotId: "slot-14",
        useDate: closedDay,
        capacity: null,
        closed: false,
        adultPrice: 42000,
        childPrice: null,
        booked: 6,
      },
    ],
  };
}

type Forced = "none" | "error" | "added" | "pending" | "unavailable";

/**
 * 예약 위젯 상태 데모 — 서버 호출 없이 위젯 본문(BookingPanel)의 모든 상태를 보여준다.
 * 달력 비활성(수요일 휴무·2일 전 마감·180일 이후)·매진 취소선·회차 마감/잔여석·옵션·파트너 확정 안내는
 * 실제 규칙(src/lib/booking.ts) 그대로 계산한다.
 */
export function BookingDemo({ today }: { today: string }) {
  const base = useMemo(() => demoProduct(today), [today]);
  const [date, setDate] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [adult, setAdult] = useState(1);
  const [child, setChild] = useState(0);
  const [forced, setForced] = useState<Forced>("none");
  const [error, setError] = useState<string | null>(null);

  const product = forced === "unavailable" ? { ...base, unavailableReason: "판매 준비 중" } : base;
  const closedDay = openDay(today, 6);

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap items-center gap-2 text-sm">
        <legend className="sr-only">위젯 상태 강제</legend>
        {(["none", "error", "added", "pending", "unavailable"] as const).map((s) => (
          <label key={s} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5">
            <input
              type="radio"
              name="booking-forced"
              checked={forced === s}
              onChange={() => {
                setForced(s);
                if (s === "added" || s === "error") {
                  // 회차 마감·남은 2석·덮어쓴 가격이 함께 보이는 날
                  setDate(closedDay);
                  setSlotId(pickSlot(base, closedDay, null));
                }
              }}
            />
            {s === "none" ? "실제 동작" : s}
          </label>
        ))}
      </fieldset>
      <div className="max-w-sm">
        <BookingPanel
          product={product}
          today={today}
          date={date}
          onDateChange={(next) => {
            setDate(next);
            setSlotId(pickSlot(base, next, slotId));
          }}
          slotId={slotId}
          onSlotChange={setSlotId}
          optionIds={optionIds}
          onOptionsChange={setOptionIds}
          adult={adult}
          child={child}
          onAdultChange={setAdult}
          onChildChange={setChild}
          error={forced === "error" ? errorMessage("sold_out") : error}
          added={forced === "added"}
          pending={forced === "pending"}
          onSubmit={() => {
            const problem = bookingCheck(product, today, date, slotId, adult, child);
            setError(problem);
            if (!problem) setForced("added");
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        예약 가능 기간: {today} ~ {addDays(today, 180)} · 수요일 휴무 · 이용 2일 전 마감 ·
        {` ${openDay(today, 4)} 매진 · ${closedDay} 10:00 마감·14:00 남은 2석`}
      </p>
    </div>
  );
}
