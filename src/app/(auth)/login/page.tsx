import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "로그인",
  description: "여운에 로그인하고 찜한 여행지와 여행 일정을 이어서 관리하세요.",
};

const NOTICES: Record<string, string> = {
  link: "인증 링크를 이 브라우저에서 확인하지 못했어요. 이메일 인증이 끝났다면 로그인해 주세요.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, notice } = await searchParams;
  const noticeKey = typeof notice === "string" ? notice : undefined;

  return (
    <>
      <h1 className="font-kr text-3xl font-semibold">로그인</h1>
      <p className="mt-2 mb-8 text-muted-foreground">찜한 여행지와 일정을 이어서 볼 수 있어요.</p>
      <LoginForm next={safeNextPath(next)} notice={noticeKey ? NOTICES[noticeKey] : undefined} />
    </>
  );
}
