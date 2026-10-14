import type { Metadata } from "next";

import { signOut } from "@/actions/auth";
import { DestinationCardEmpty } from "@/components/destination/destination-card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "나의 여행",
  // 개인 페이지는 검색 결과에 노출하지 않는다
  robots: { index: false, follow: false },
};

/**
 * 나의 여행 (보호된 페이지)
 * 4단계: 로그인 확인과 기본 틀만. 찜 목록(6단계)과 일정 플래너(7단계)는 이후 연결한다.
 */
export default async function MyPage() {
  // proxy가 1차로 막지만, 페이지에서도 다시 확인한다 (다중 방어)
  const user = await requireUser("/my");

  return (
    <div className="container flex flex-col gap-8 py-10 md:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-2xl text-muted-foreground italic">My trips</p>
          <h1 className="font-kr text-4xl font-semibold">나의 여행</h1>
          <p className="mt-2 text-muted-foreground">
            {user.displayName}님, 다음 여행은 어디로 떠나볼까요?
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="h-10 rounded-md px-4">
            로그아웃
          </Button>
        </form>
      </header>

      <section aria-labelledby="likes-title" className="flex flex-col gap-4">
        <h2 id="likes-title" className="font-kr text-2xl font-semibold">
          찜 목록
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <DestinationCardEmpty />
        </div>
      </section>
    </div>
  );
}
