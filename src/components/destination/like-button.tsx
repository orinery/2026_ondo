"use client";

import { HeartIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type LikeButtonProps = {
  destinationName: string;
  initialLiked?: boolean;
  // overlay: 사진 위 흰 원형 (카드) / outline: 일반 배경 위 버튼 (상세 헤더·하단 CTA)
  variant?: "overlay" | "outline";
  // 지금은 로컬 상태만 바꾼다. 6단계에서 Server Action + useOptimistic으로 교체한다.
  onToggle?: (liked: boolean) => void;
  className?: string;
};

/**
 * 찜 토글 버튼 (명세 5.1 Anatomy: 44×44, 찜됨이면 ♥ 코랄 + aria-pressed)
 */
export function LikeButton({
  destinationName,
  initialLiked = false,
  variant = "overlay",
  onToggle,
  className,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);

  return (
    <button
      type="button"
      aria-label={`${destinationName} 찜하기`}
      aria-pressed={liked}
      onClick={() => {
        const next = !liked;
        setLiked(next);
        onToggle?.(next);
      }}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-fast",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        // 사진 위에 놓이므로 테마와 무관하게 흰 배경 + 고정 색을 쓴다
        variant === "overlay" && "bg-white/95 text-stone-700 hover:bg-white",
        variant === "overlay" && liked && "bg-white text-glow-500",
        variant === "outline" && "border border-input bg-background hover:bg-muted",
        variant === "outline" && liked && "text-highlight",
        className,
      )}
    >
      <HeartIcon aria-hidden className={cn("size-5", liked && "fill-current")} />
    </button>
  );
}
