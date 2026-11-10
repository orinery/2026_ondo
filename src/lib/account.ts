/**
 * 회원 탈퇴를 막는 이유 (DB 함수 account_deletion_blocker·delete_my_account가 돌려주는 코드, 0040)
 * → 계정 설정 화면에 미리 보여 주는 문장
 */
const BLOCKER_MESSAGES: Record<string, string> = {
  account_has_role:
    "파트너·관리자 계정은 상품·정산 기록이 연결돼 있어 바로 탈퇴할 수 없어요. 운영팀에 문의해 주세요.",
  has_upcoming_bookings:
    "이용 예정인 예약이 있어요. 예약을 취소하거나 이용을 마친 뒤 탈퇴할 수 있어요.",
  unauthenticated: "로그인이 필요해요.",
};

export function deletionBlockerMessage(code: string): string {
  return BLOCKER_MESSAGES[code] ?? "지금은 탈퇴할 수 없어요. 잠시 후 다시 시도해 주세요.";
}

/** DB 오류 메시지에서 탈퇴를 막은 코드를 찾는다 (raise exception '<code>') */
export function knownBlocker(message: string | undefined): string | null {
  if (!message) return null;
  return Object.keys(BLOCKER_MESSAGES).find((code) => message.includes(code)) ?? null;
}
