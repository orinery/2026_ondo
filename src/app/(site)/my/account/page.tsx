import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DeleteAccountSection } from "@/components/account/delete-account-section";
import { PasswordForm } from "@/components/account/password-form";
import { ProfileForm } from "@/components/account/profile-form";
import { deletionBlockerMessage } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { getDeletionBlocker } from "@/lib/data/account";

export const metadata: Metadata = {
  title: "계정 설정",
  robots: { index: false, follow: false },
};

/**
 * 계정 설정 (/my/account) — 회원 정보(이름) · 비밀번호 변경 · 회원 탈퇴.
 * 로그인 아이디인 이메일은 바꿀 수 없다 (확인 메일이 필요한 기능은 두지 않음 — 사용자 확정).
 */
export default async function AccountPage() {
  // proxy가 1차로 막지만, 페이지에서도 다시 확인한다 (다중 방어)
  const user = await requireUser("/my/account");
  const blocker = await getDeletionBlocker();

  return (
    <div className="container flex max-w-3xl flex-col gap-8 py-10 md:py-14">
      <div className="flex flex-col gap-4">
        <Link
          href="/my"
          className="inline-flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon aria-hidden className="size-4" />
          나의 여행
        </Link>
        <header>
          <p className="font-display text-2xl text-muted-foreground italic">Account</p>
          <h1 className="font-kr text-4xl font-semibold">계정 설정</h1>
        </header>
      </div>

      <ProfileForm email={user.email ?? ""} name={user.displayName} />
      <PasswordForm email={user.email ?? ""} />
      <DeleteAccountSection blockedReason={blocker ? deletionBlockerMessage(blocker) : null} />
    </div>
  );
}
