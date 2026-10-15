import { FolderOpenIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/actions/auth";
import { ProductCard, ProductCardEmpty, ProductGrid } from "@/components/product/product-card";
import { FolderChips } from "@/components/my/folder-chips";
import { MoveToFolderMenu } from "@/components/my/move-to-folder-menu";
import { PlannerView } from "@/components/planner/planner-view";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getMyLikes } from "@/lib/data/likes";
import { getMyTrips, getTrip } from "@/lib/data/trips";
import { seoulNow } from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "나의 여행",
  // 개인 페이지는 검색 결과에 노출하지 않는다
  robots: { index: false, follow: false },
};

const TABS = [
  { value: "likes", label: "찜 목록" },
  { value: "planner", label: "일정 플래너" },
] as const;
type Tab = (typeof TABS)[number]["value"];

/**
 * 나의 여행 (명세 4.4, 보호된 페이지)
 * 탭과 폴더 선택은 URL 쿼리(?tab=&folder=)와 동기화한다 → 새로고침·공유해도 같은 화면
 */
export default async function MyPage({ searchParams }: PageProps<"/my">) {
  // proxy가 1차로 막지만, 페이지에서도 다시 확인한다 (다중 방어)
  const user = await requireUser("/my");
  const params = await searchParams;
  const tab: Tab = params.tab === "planner" ? "planner" : "likes";

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

      {/* 탭: 링크로 구현해 URL과 동기화 (명세 4.4) */}
      <nav aria-label="나의 여행 메뉴" className="flex w-full max-w-sm rounded-md bg-muted p-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/my?tab=${t.value}`}
            scroll={false}
            aria-current={tab === t.value ? "page" : undefined}
            className={cn(
              "flex h-11 flex-1 items-center justify-center rounded-sm text-sm font-medium text-muted-foreground transition-colors duration-fast",
              tab === t.value && "bg-card font-semibold text-foreground shadow-sm",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "likes" ? (
        <LikesTab folderParam={typeof params.folder === "string" ? params.folder : null} />
      ) : (
        <PlannerTab tripParam={typeof params.trip === "string" ? params.trip : null} />
      )}
    </div>
  );
}

async function LikesTab({ folderParam }: { folderParam: string | null }) {
  const { likes, folders } = await getMyLikes();
  // 없는 폴더 id가 URL에 들어오면 '전체'로 취급한다
  const activeFolder = folders.find((f) => f.id === folderParam) ?? null;
  const visible = activeFolder ? likes.filter((l) => l.folderId === activeFolder.id) : likes;

  return (
    <section aria-label="찜 목록" className="flex flex-col gap-6">
      <FolderChips
        folders={folders}
        activeFolderId={activeFolder?.id ?? null}
        totalCount={likes.length}
      />

      {likes.length === 0 ? (
        // 찜이 하나도 없을 때 (명세 5.1 Empty)
        <ProductGrid>
          <ProductCardEmpty />
        </ProductGrid>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-input px-6 py-16 text-center">
          <FolderOpenIcon aria-hidden className="size-6 text-muted-foreground" />
          <p className="font-semibold">‘{activeFolder?.name}’ 폴더가 비어 있어요</p>
          <p className="text-sm text-muted-foreground">
            ‘전체’에서 카드 아래 폴더 버튼으로 상품을 옮겨 보세요.
          </p>
        </div>
      ) : (
        <ProductGrid>
          {visible.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              initialLiked
              priority={i < 4}
              footer={
                <MoveToFolderMenu
                  productId={p.id}
                  productTitle={p.title}
                  folderId={p.folderId}
                  folders={folders}
                />
              }
            />
          ))}
        </ProductGrid>
      )}
    </section>
  );
}

/** 일정 플래너 탭 — 조회는 서버에서, 편집은 PlannerView(클라이언트)에서 */
async function PlannerTab({ tripParam }: { tripParam: string | null }) {
  const [trips, { likes }] = await Promise.all([getMyTrips(), getMyLikes()]);
  // URL의 여행 id가 없거나 내 여행이 아니면 첫 번째 여행을 연다
  const selectedId = trips.find((t) => t.id === tripParam)?.id ?? trips[0]?.id ?? null;
  const trip = selectedId ? await getTrip(selectedId) : null;

  return (
    <section aria-label="일정 플래너">
      <PlannerView
        trips={trips}
        trip={trip}
        likes={likes.map((l) => ({
          id: l.id,
          title: l.title,
          cityName: l.city.name,
          imageUrl: l.imageUrl,
          imageAlt: l.imageAlt,
        }))}
        // 서버 시간 기준으로 계산해 넘긴다 — 브라우저에서 따로 계산하면 서버 HTML과 달라질 수 있다
        now={seoulNow()}
      />
    </section>
  );
}
