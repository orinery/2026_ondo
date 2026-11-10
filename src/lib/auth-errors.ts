import type { AuthError } from "@supabase/supabase-js";

/**
 * Supabase 인증 에러 코드를 사용자에게 보여줄 한국어 문구로 바꾼다 (로그인·가입·계정 설정 공용).
 * 로그인 실패는 "이메일이 없는지 / 비밀번호가 틀렸는지"를 구분하지 않는다
 * — 구분해 주면 가입된 이메일을 알아내는 데 악용될 수 있다.
 */
export function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "이메일 또는 비밀번호가 맞지 않아요";
    case "email_not_confirmed":
      return "이메일 인증이 아직 끝나지 않았어요. 받은 메일의 링크를 눌러 주세요";
    case "user_already_exists":
    case "email_exists":
      return "이미 가입된 이메일이에요. 로그인해 주세요";
    case "weak_password":
      return "더 안전한 비밀번호를 사용해 주세요";
    case "same_password":
      return "지금과 다른 비밀번호를 입력해 주세요";
    case "reauthentication_needed":
      return "보안을 위해 다시 로그인한 뒤 바꿔 주세요";
    case "over_email_send_rate_limit":
      return "인증 메일 발송 한도를 넘었어요. 잠시 후 다시 시도해 주세요";
    case "over_request_rate_limit":
      return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요";
    default:
      return "잠시 문제가 생겼어요. 다시 시도해 주세요";
  }
}
