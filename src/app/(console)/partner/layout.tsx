import { BanIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConsoleShell } from "@/components/console/console-shell";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "파트너 센터", template: "%s | 여운 파트너 센터" },
  robots: { index: false, follow: false },
};

/**
 * 파트너 센터 공통 레이아웃.
 * 파트너가 아니면 파트너 신청 페이지로 보낸다. 이용 정지된 파트너는 안내만 보여준다
 * (DB에서도 my_partner_id()가 null이 되어 상품·예약 데이터에 접근할 수 없다).
 */
export default async function PartnerLayout({ children }: LayoutProps<"/partner">) {
  const user = await requireRole("partner", "/partner");
  const partner = user.partner;

  return (
    <ConsoleShell section="partner" userName={user.displayName} subtitle={partner?.name}>
      {partner?.status === "active" ? (
        children
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 py-16">
          <div role="alert" className="flex max-w-md flex-col items-center gap-3 text-center">
            <BanIcon aria-hidden className="size-10 text-destructive" />
            <h1 className="font-kr text-2xl font-semibold">파트너 센터를 이용할 수 없어요</h1>
            <p className="text-muted-foreground">
              {partner
                ? "관리자가 이 파트너의 이용을 정지했어요. 공개된 상품의 판매는 그대로 유지돼요."
                : "연결된 파트너 정보를 찾지 못했어요."}{" "}
              자세한 내용은 운영팀에 문의해 주세요.
            </p>
            <Link href="/" className="text-sm font-semibold text-primary hover:underline">
              사이트로 돌아가기 →
            </Link>
          </div>
        </div>
      )}
    </ConsoleShell>
  );
}
