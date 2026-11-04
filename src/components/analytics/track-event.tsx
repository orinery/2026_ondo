"use client";

import { useEffect, useRef } from "react";

import type { FunnelEvent } from "@/lib/funnel";
import { track } from "@/lib/track";

/**
 * 서버 컴포넌트 페이지에 넣어 "이 화면을 열었다"를 한 번 기록한다 (상세 · 주문서 · 주문 완료).
 * 화면에는 아무것도 그리지 않는다. 브라우저에서 실행되므로 JS를 실행하지 않는 봇은 세지 않는다.
 */
export function TrackEvent({ name, productId }: { name: FunnelEvent; productId?: string }) {
  // 개발 모드(Strict Mode)에서 effect가 두 번 실행돼도 한 번만 보낸다.
  // 키로 비교해서, 같은 자리에서 다른 상품으로 바뀌면 다시 보낸다
  const sent = useRef<string | null>(null);
  useEffect(() => {
    const key = `${name}:${productId ?? ""}`;
    if (sent.current === key) return;
    sent.current = key;
    track(name, productId);
  }, [name, productId]);
  return null;
}
