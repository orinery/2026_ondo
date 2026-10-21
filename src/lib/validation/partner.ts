import { z } from "zod";

/**
 * 파트너 신청·관리자 처리 입력 검증 — 폼(클라이언트)과 Server Action이 같이 쓴다.
 * 범위·형식은 partner_applications 테이블 CHECK 제약과 맞췄다.
 */

/**
 * 사업자 연락처 정리: 휴대폰뿐 아니라 일반 전화도 받는다.
 * "0212345678" → "02-1234-5678", "0515550202" → "051-555-0202", "01012345678" → "010-1234-5678"
 * 형식이 아니면 그대로 두고 검증에서 걸러진다.
 */
export function normalizeContactPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  // 서울(02)만 지역번호가 두 자리
  const areaLength = digits.startsWith("02") ? 2 : 3;
  const rest = digits.slice(areaLength);
  if (!/^0\d+$/.test(digits) || rest.length < 7 || rest.length > 8) return value.trim();
  const middle = rest.length - 4;
  return `${digits.slice(0, areaLength)}-${rest.slice(0, middle)}-${rest.slice(middle)}`;
}

export const partnerApplicationSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, "상호(파트너 이름)를 입력해 주세요")
    .max(40, "상호는 40자 이하로 입력해 주세요"),
  contactName: z
    .string()
    .trim()
    .min(1, "담당자 이름을 입력해 주세요")
    .max(30, "이름은 30자 이하로 입력해 주세요"),
  contactPhone: z
    .string()
    .transform(normalizeContactPhone)
    .pipe(
      z
        .string()
        .regex(
          /^0\d{1,2}-\d{3,4}-\d{4}$/,
          "연락처를 확인해 주세요 (예: 02-123-4567, 010-1234-5678)",
        ),
    ),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("이메일 주소를 확인해 주세요")),
  intro: z
    .string()
    .trim()
    .min(10, "소개를 10자 이상 입력해 주세요")
    .max(500, "소개는 500자 이하로 입력해 주세요"),
});

export type PartnerApplicationInput = z.infer<typeof partnerApplicationSchema>;
export type PartnerApplicationField = keyof PartnerApplicationInput;

export const rejectReasonSchema = z
  .string()
  .trim()
  .min(1, "거절 사유를 입력해 주세요")
  .max(200, "거절 사유는 200자 이하로 입력해 주세요");
