"use client";

import { CheckIcon, Share2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 공유 — 모바일은 기기 공유 시트(Web Share API), 지원하지 않으면 링크 복사로 대체한다.
 */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // 사용자가 공유 시트를 닫은 경우 — 아무것도 하지 않는다
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={share}
      className={cn("h-11 gap-1.5 rounded-md px-4", className)}
    >
      {copied ? (
        <CheckIcon aria-hidden className="size-4" />
      ) : (
        <Share2Icon aria-hidden className="size-4" />
      )}
      {/* 복사 완료를 스크린리더에도 알린다 */}
      <span aria-live="polite">{copied ? "링크 복사됨" : "공유"}</span>
    </Button>
  );
}
