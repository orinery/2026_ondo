import type { Metadata } from "next";

import { ConsoleShell } from "@/components/console/console-shell";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "관리자 콘솔", template: "%s | 여운 관리자" },
  robots: { index: false, follow: false },
};

/**
 * 관리자 콘솔 공통 레이아웃.
 * 관리자가 아니면 404 — 응답이 시작되기 전에 결정해야 해서 loading.tsx는 (pages) 그룹 안에 둔다
 * (상품 상세 레이아웃의 404 확인과 같은 이유). 클라이언트 이동 시에는 레이아웃이 다시 실행되지 않으므로
 * 각 페이지·액션·DB 함수가 권한을 다시 확인한다.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireRole("admin", "/admin");
  return (
    <ConsoleShell section="admin" userName={user.displayName}>
      {children}
    </ConsoleShell>
  );
}
