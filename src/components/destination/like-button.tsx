"use client";

import { HeartIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import { toggleLike } from "@/actions/likes";
import { cn } from "@/lib/utils";

type LikeButtonProps = {
  destinationId: string;
  destinationName: string;
  initialLiked?: boolean;
  // overlay: 사진 위 흰 원형 (카드) / outline: 일반 배경 위 버튼 (상세 헤더·하단 CTA)
  variant?: "overlay" | "outline";
  // local: 서버에 저장하지 않는 데모용(/dev/components)
  mode?: "server" | "local";
  className?: string;
};

/**
 * 찜 토글 버튼 (명세 5.1 Anatomy: 44×44, 찜됨이면 ♥ 코랄 + aria-pressed)
 *
 * 낙관적 업데이트(useOptimistic): 누르는 즉시 하트를 바꾸고 서버 저장은 뒤에서 진행한다.
 * 저장에 실패하면 transition이 끝날 때 서버 값(initialLiked)으로 자동 복귀한다.
 * 비로그인 상태면 로그인 페이지로 보낸 뒤 지금 페이지로 돌아오게 한다.
 */
export function LikeButton({
  destinationId,
  destinationName,
  initialLiked = false,
  variant = "overlay",
  mode = "server",
  className,
}: LikeButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [localLiked, setLocalLiked] = useState(initialLiked);
  const [optimisticLiked, setOptimisticLiked] = useOptimistic(initialLiked);
  const [message, setMessage] = useState("");

  const liked = mode === "local" ? localLiked : optimisticLiked;

  const onClick = () => {
    const next = !liked;
    if (mode === "local") {
      setLocalLiked(next);
      return;
    }
    startTransition(async () => {
      setOptimisticLiked(next);
      const result = await toggleLike(destinationId, next);
      if (result.ok) {
        setMessage(
          next ? `${destinationName}을(를) 찜했어요` : `${destinationName} 찜을 해제했어요`,
        );
      } else if (result.reason === "unauthenticated") {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
      } else {
        setMessage("찜을 저장하지 못했어요. 다시 시도해 주세요");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label={`${destinationName} 찜하기`}
        aria-pressed={liked}
        onClick={onClick}
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
      {/* 결과를 스크린리더에 알린다 (화면에는 하트 변화로 충분) */}
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
