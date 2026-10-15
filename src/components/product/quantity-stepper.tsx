"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  label: string; // "성인"
  description?: string; // "45,000원"
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * 인원 선택 (− 숫자 +). 예약 위젯과 장바구니가 같이 쓴다.
 * 버튼에 "성인 한 명 더하기"처럼 무엇을 바꾸는지 이름을 붙이고, 바뀐 숫자는 aria-live로 읽어 준다.
 */
export function QuantityStepper({
  label,
  description,
  value,
  min = 0,
  max,
  onChange,
  disabled = false,
  className,
}: QuantityStepperProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <p className="text-base font-medium">{label}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div role="group" aria-label={`${label} 인원`} className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 rounded-full"
          aria-label={`${label} 한 명 빼기`}
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
        >
          <MinusIcon aria-hidden />
        </Button>
        <span aria-live="polite" className="w-7 text-center text-lg font-semibold tabular-nums">
          {value}
          <span className="sr-only">명</span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 rounded-full"
          aria-label={`${label} 한 명 더하기`}
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
        >
          <PlusIcon aria-hidden />
        </Button>
      </div>
    </div>
  );
}
