import Image from "next/image";
import Link from "next/link";

const COVER = {
  src: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=80",
  alt: "야사카 탑이 보이는 교토 골목에 기모노를 입은 두 사람이 서 있다",
};

/**
 * 로그인 / 회원가입 공통 레이아웃 (명세 4.5)
 * - 768 이상: 6/6 스플릿 — 시즌 사진 + 짧은 문구 / 폼(최대 폭 400)
 * - 767 이하: 사진 제거, 폼 단일 컬럼, 키보드가 올라와도 입력칸이 가려지지 않게 하단 여백
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      {/* 768 이상 왼쪽 계절 사진·문구: 장식 영역이라 보조 기술에서 숨긴다 (랜드마크 밖 콘텐츠 — axe region) */}
      <div aria-hidden className="relative hidden overflow-hidden bg-muted md:block">
        <Image
          src={COVER.src}
          alt={COVER.alt}
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        {/* 문구 가독성을 위한 하단 스크림 */}
        <div className="absolute inset-0 bg-linear-to-b from-transparent from-45% to-stone-900/70" />
        <div className="absolute inset-x-10 bottom-12 text-white">
          <p className="font-display text-2xl italic">Autumn edit — 2026</p>
          <p className="mt-2 font-kr text-3xl font-semibold">
            떠나기 전의 설렘이
            <br />
            돌아온 뒤의 여운으로.
          </p>
        </div>
      </div>

      <main id="main-content" className="flex flex-col px-5 pt-6 pb-24 md:px-10 md:pb-10">
        <Link href="/" className="flex w-fit items-baseline gap-2 rounded-sm">
          <span className="font-kr text-xl font-semibold tracking-tight">여운</span>
          <span className="font-display text-lg text-muted-foreground">Yeoun</span>
        </Link>
        <div className="mx-auto flex w-full max-w-100 flex-1 flex-col justify-center py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
