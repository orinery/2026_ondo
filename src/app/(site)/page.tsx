import Link from "next/link";

// 임시 홈. 5단계에서 디자인 명세 4.1의 메인 레이아웃(히어로 · 추천 여행지 · 테마 컬렉션)으로 교체한다.
export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="font-kr text-2xl font-semibold">여운</h1>
      <p className="text-muted-foreground">메인 페이지는 5단계에서 만들어집니다.</p>
      <Link
        href="/dev/components"
        className="mt-2 text-sm font-semibold text-primary hover:underline"
      >
        지금까지 만든 컴포넌트 보기 →
      </Link>
    </div>
  );
}
