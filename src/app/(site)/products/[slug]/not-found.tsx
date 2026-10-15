import { CompassIcon } from "lucide-react";
import Link from "next/link";

/** 없는 상품 주소로 들어왔을 때 (사이트 레이아웃 안에서 보여준다) */
export default function ProductNotFound() {
  return (
    <div className="container flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted">
        <CompassIcon aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <h1 className="font-kr text-2xl font-semibold">상품을 찾을 수 없어요</h1>
      <p className="text-muted-foreground">주소가 바뀌었거나 더 이상 판매하지 않는 상품이에요.</p>
      <Link href="/products" className="mt-2 font-semibold text-primary hover:underline">
        다른 상품 둘러보기 →
      </Link>
    </div>
  );
}
