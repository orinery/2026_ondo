"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 예약 상세 인쇄 (Quick Win Q8) — 종이 바우처를 원하는 고객용.
 * 인쇄할 때는 내비게이션·푸터·버튼을 숨기고 항상 밝은 색으로 찍힌다 (globals.css의 print 규칙, print:hidden).
 */
export function PrintButton({ label = "인쇄" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => window.print()}
      className="h-9 rounded-md px-3 text-sm print:hidden"
    >
      <PrinterIcon aria-hidden className="size-4" />
      {label}
    </Button>
  );
}
