"use client";

import { HeartIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type LikeButtonProps = {
  destinationName: string;
  initialLiked?: boolean;
  // 2단계에서는 로컬 상태만 바꾼다. 6단계에서 Server Action + useOptimistic으로 교체한다.
  onToggle?: (liked: boolean) => void;
  className?: string;
};

/**
 * 찜 토글 버튼 (명세 5.1 Anatomy: 44×44, 찜됨이면 ♥ highlight 컬러 + aria-pressed)
 * 사진 위에 놓이므로 테마와 무관하게 흰 원형 배경을 쓴다.
 */
export function LikeButton({
  destinationName,
  initialLiked = false,
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
        "grid size-11 place-items-center rounded-full bg-white/95 text-stone-700 transition-colors duration-fast",
        "hover:bg-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        liked && "bg-white text-glow-500",
        className,
      )}
    >
      <HeartIcon aria-hidden className={cn("size-5", liked && "fill-current")} />
    </button>
  );
}
