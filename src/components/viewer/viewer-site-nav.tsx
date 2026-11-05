"use client";

import type { ComponentProps } from "react";

import { SiteNav } from "@/components/layout/site-nav";

import { useViewer } from "./viewer-provider";

type Props = Omit<ComponentProps<typeof SiteNav>, "user" | "isUserLoading" | "cartCount">;

/** 일반 페이지 내비게이션 — 아바타·장바구니 수는 /api/me 응답(useViewer)으로 채운다 (S2) */
export function ViewerSiteNav(props: Props) {
  const { status, user, cartCount } = useViewer();
  return (
    <SiteNav {...props} user={user} isUserLoading={status === "loading"} cartCount={cartCount} />
  );
}
