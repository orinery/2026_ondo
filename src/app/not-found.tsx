import { CompassIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "페이지를 찾을 수 없어요" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted">
        <CompassIcon aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <p className="font-display text-2xl text-muted-foreground italic">404</p>
      <h1 className="font-kr text-2xl font-semibold">길을 잃은 것 같아요</h1>
      <p className="text-muted-foreground">주소가 바뀌었거나 사라진 페이지예요.</p>
      <Link href="/products" className="mt-2 font-semibold text-primary hover:underline">
        상품 둘러보기 →
      </Link>
    </main>
  );
}
