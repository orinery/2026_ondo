/**
 * 소셜 로그인 버튼 (명세 4.5: 구분선 → 카카오 · Google)
 * 사용자 확정: 화면에만 두고 기능은 연결하지 않는다 → disabled + "준비 중" 표시.
 * 연결 시에는 supabase.auth.signInWithOAuth({ provider })를 호출하는 Server Action으로 바꾼다.
 *
 * 브랜드 색(카카오 노랑 등)은 디자인 토큰에 없으므로 기능을 연결할 때 토큰 추가를 함께 결정한다.
 */
const PROVIDERS = [
  { id: "kakao", label: "카카오로 계속하기" },
  { id: "google", label: "Google로 계속하기" },
] as const;

export function SocialButtons() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        또는
        <span className="h-px flex-1 bg-border" />
      </div>
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled
          className="flex h-12 items-center justify-center gap-2 rounded-md border border-input bg-card text-base font-medium disabled:cursor-not-allowed disabled:opacity-55"
        >
          {p.label}
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            준비 중
          </span>
        </button>
      ))}
    </div>
  );
}
