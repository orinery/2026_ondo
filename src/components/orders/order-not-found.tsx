import { ReceiptTextIcon } from "lucide-react";
import Link from "next/link";

/** 없는 주문번호이거나 남의 주문일 때 (RLS로 조회 결과가 없으면 둘을 구분할 수 없다 — 의도한 동작) */
export function OrderNotFound() {
  return (
    <div className="container flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted">
        <ReceiptTextIcon aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <h1 className="font-kr text-2xl font-semibold">주문을 찾을 수 없어요</h1>
      <p className="text-muted-foreground">주문번호를 확인하거나 예약 내역에서 찾아 주세요.</p>
      <Link href="/my?tab=orders" className="mt-2 font-semibold text-primary hover:underline">
        예약 내역 보기 →
      </Link>
    </div>
  );
}
