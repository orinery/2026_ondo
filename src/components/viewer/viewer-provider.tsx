"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { ViewerSnapshot, ViewerUser } from "@/lib/viewer";

type Viewer = {
  status: "loading" | "ready"; // loading = 아직 /api/me 응답 전 (첫 화면)
  user: ViewerUser | null;
  cartCount: number;
  likedIds: ReadonlySet<string>;
  version: number; // refresh() 횟수 — 상품별로 따로 묻는 값(리뷰 권한)도 함께 다시 불러오게
  refresh: () => void; // 장바구니 담기·삭제처럼 같은 화면에 머무는 변경 뒤에 부른다
  setLiked: (productId: string, liked: boolean) => void; // 찜 저장에 성공하면 바로 반영
  signOutLocally: () => void; // 로그아웃 버튼 — 서버 응답 전에 화면부터 비로그인으로
};

const LOGGED_OUT: ViewerSnapshot = { user: null, cartCount: 0, likedIds: [] };
const noop = () => {};

// Provider 밖(디자인 쇼케이스 등)에서는 비로그인으로 동작한다
const ViewerContext = createContext<Viewer>({
  status: "ready",
  user: null,
  cartCount: 0,
  likedIds: new Set(),
  version: 0,
  refresh: noop,
  setLiked: noop,
  signOutLocally: noop,
});

export const useViewer = () => useContext(ViewerContext);

/**
 * 지금 보는 사람 정보 (S2 속도 개선) — 메인·상품 상세는 모두에게 같은 HTML을 엣지 캐시에서 받고,
 * 사람마다 다른 값(아바타·장바구니 수·찜)은 여기서 /api/me로 불러와 나눠 준다.
 * - 페이지를 옮길 때마다 다시 불러온다: 로그인·주문 완료처럼 이동으로 끝나는 변경이 자연스럽게 반영된다.
 * - 이동 없이 바뀌는 값은 refresh()·setLiked()로 알린다.
 * - 다시 불러오는 동안에는 이전 값을 그대로 보여 준다 (아바타가 깜빡이지 않게).
 */
export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<ViewerSnapshot | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/me", { signal: ctrl.signal, cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<ViewerSnapshot>) : Promise.reject(res)))
      .then(setSnapshot)
      .catch(() => {
        // 실패하면 이전 값을 두고, 첫 화면이면 비로그인으로 그린다 (담기 등은 서버가 다시 확인한다)
        if (!ctrl.signal.aborted) setSnapshot((prev) => prev ?? LOGGED_OUT);
      });
    return () => ctrl.abort();
  }, [pathname, version]);

  const value = useMemo<Viewer>(() => {
    const s = snapshot ?? LOGGED_OUT;
    return {
      status: snapshot ? "ready" : "loading",
      user: s.user,
      cartCount: s.cartCount,
      likedIds: new Set(s.likedIds),
      version,
      refresh: () => setVersion((v) => v + 1),
      setLiked: (productId, liked) =>
        setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                likedIds: liked
                  ? [...new Set([...prev.likedIds, productId])]
                  : prev.likedIds.filter((id) => id !== productId),
              }
            : prev,
        ),
      signOutLocally: () => setSnapshot(LOGGED_OUT),
    };
  }, [snapshot, version]);

  return <ViewerContext value={value}>{children}</ViewerContext>;
}
