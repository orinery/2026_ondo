"use client";

import { XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * 탈퇴 완료 안내 (/?notice=withdrawn) — 메인은 캐시된 정적 페이지라 쿼리는 브라우저에서 읽는다.
 * 닫으면 주소에서 쿼리를 지운다 (새로고침해도 다시 뜨지 않게).
 */
export function WithdrawnNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  if (params.get("notice") !== "withdrawn") return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-start gap-3 rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg md:bottom-8"
    >
      <p className="flex-1">탈퇴가 끝났어요. 그동안 여운을 이용해 주셔서 고마워요.</p>
      <button
        type="button"
        aria-label="안내 닫기"
        onClick={() => router.replace(pathname, { scroll: false })}
        className="-m-1 grid size-7 shrink-0 place-items-center rounded-full hover:bg-background/15"
      >
        <XIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}
