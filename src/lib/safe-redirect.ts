/**
 * 로그인 후 돌아갈 경로(?next=)를 검증한다.
 * 왜: next 값을 그대로 쓰면 `?next=https://evil.com`이나 `//evil.com`으로
 * 다른 사이트에 보내는 "오픈 리다이렉트" 공격이 가능하다. 같은 사이트의 경로만 허용한다.
 */
export function safeNextPath(next: unknown, fallback = "/my"): string {
  if (typeof next !== "string") return fallback;
  // "/"로 시작하되 "//"(프로토콜 상대 URL)나 "/\"(브라우저가 //로 해석)는 거부
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
