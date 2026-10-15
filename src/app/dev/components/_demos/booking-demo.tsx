"use client";

import { useState } from "react";

import { BookingPanel, type BookingProduct } from "@/components/product/booking-widget";
import { addDays, bookingError, bookingTotal, firstAvailableDate } from "@/lib/booking";
import { errorMessage } from "@/lib/order-errors";

const PRODUCT: BookingProduct = {
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
  startTime: "14:00",
  durationText: "약 1시간",
};

type Forced = "none" | "error" | "added" | "pending" | "unavailable";

/**
 * 예약 위젯 상태 데모 — 서버 호출 없이 위젯 본문(BookingPanel)의 모든 상태를 보여준다.
 * 달력의 비활성 날짜(수요일 휴무·2일 전 마감·180일 이후)는 실제 규칙(src/lib/booking.ts) 그대로다.
 */
export function BookingDemo({ today }: { today: string }) {
  const [date, setDate] = useState<string | null>(null);
  const [adult, setAdult] = useState(1);
  const [child, setChild] = useState(0);
  const [forced, setForced] = useState<Forced>("none");
  const [error, setError] = useState<string | null>(null);

  const product =
    forced === "unavailable" ? { ...PRODUCT, unavailableReason: "판매 준비 중" } : PRODUCT;

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
                if (s === "added" || s === "error") setDate(firstAvailableDate(PRODUCT, today));
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
          onDateChange={setDate}
          adult={adult}
          child={child}
          onAdultChange={setAdult}
          onChildChange={setChild}
          total={bookingTotal(product, adult, child)}
          error={forced === "error" ? errorMessage("price_changed") : error}
          added={forced === "added"}
          pending={forced === "pending"}
          onSubmit={() => {
            if (!date) return setError("이용일을 선택해 주세요.");
            const code = bookingError(product, date, adult, child, today);
            setError(code ? errorMessage(code) : null);
            if (!code) setForced("added");
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        예약 가능 기간: {today} ~ {addDays(today, 180)} · 수요일 휴무 · 이용 2일 전 마감
      </p>
    </div>
  );
}
