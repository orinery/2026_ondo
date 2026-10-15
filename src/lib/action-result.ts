/**
 * Server Action의 공통 반환 형태.
 * 예외를 던지지 않고 결과로 돌려줘서, 클라이언트가 "로그인 필요 / 입력 오류 / 서버 오류"를 구분해 안내할 수 있게 한다.
 */
export type ActionFailure = {
  ok: false;
  reason: "unauthenticated" | "invalid" | "error";
  message?: string;
};

export type ActionResult<T = undefined> =
  ({ ok: true } & (T extends undefined ? unknown : T)) | ActionFailure;
