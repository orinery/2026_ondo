"use client";

import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * 페이지 렌더링 중 예상치 못한 에러가 났을 때의 화면.
 * 에러 상세는 사용자에게 보여주지 않고(정보 노출 방지) 콘솔에만 남긴다.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="container flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center"
    >
      <div className="grid size-14 place-items-center rounded-full bg-muted">
        <TriangleAlertIcon aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <h1 className="font-kr text-2xl font-semibold">페이지를 불러오지 못했어요</h1>
      <p className="text-muted-foreground">잠시 후 다시 시도해 주세요.</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={reset} className="h-11 rounded-md px-5 text-base">
          다시 시도
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-md px-5 text-base">
          <Link href="/">홈으로</Link>
        </Button>
      </div>
    </div>
  );
}
