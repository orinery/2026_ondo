import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/signup-form";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "회원가입",
  description: "여운에 가입하고 마음에 드는 여행지를 찜하고, 날짜별 여행 일정을 만들어 보세요.",
};

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;

  return (
    <>
      <h1 className="font-kr text-3xl font-semibold">회원가입</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        마음에 드는 여행지를 모으고 일정을 짜 보세요.
      </p>
      <SignupForm next={safeNextPath(next)} />
    </>
  );
}
