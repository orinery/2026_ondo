import { z } from "zod";

/**
 * 주문서 입력 검증 — 주문서 폼(클라이언트)과 placeOrder Server Action이 같이 쓴다.
 * 범위·형식은 orders 테이블 CHECK 제약(이름 1~30자, 이메일, 휴대폰 010-0000-0000)과 맞췄다.
 */

/** "01012345678" / "010 1234 5678" → "010-1234-5678" (형식이 아니면 그대로 두고 검증에서 걸러진다) */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!/^01[016789]\d{7,8}$/.test(digits)) return value.trim();
  return digits.length === 10
    ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    : `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export const bookerSchema = z.object({
  bookerName: z
    .string()
    .trim()
    .min(1, "예약자 이름을 입력해 주세요")
    .max(30, "이름은 30자 이하로 입력해 주세요"),
  bookerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("이메일 주소를 확인해 주세요")),
  bookerPhone: z
    .string()
    .transform(normalizePhone)
    .pipe(
      z
        .string()
        .regex(/^01[016789]-\d{3,4}-\d{4}$/, "휴대폰 번호를 확인해 주세요 (예: 010-1234-5678)"),
    ),
});

export const checkoutSchema = bookerSchema.extend({
  cartItemIds: z.array(z.uuid()).min(1, "주문할 상품이 없어요").max(20),
  // 체크박스는 체크하면 "on"이 온다
  policyAgreed: z.literal("on", { error: "취소 규정에 동의해 주세요" }),
  // 예약 정보 파트너 제공 동의는 취소 규정과 따로 받는다 (A-04)
  piiShareAgreed: z.literal("on", { error: "예약 정보 제공에 동의해 주세요" }),
  expectedTotal: z.coerce.number().int().positive(),
  idempotencyKey: z.uuid(),
});

/** 주문서 URL ?items=id1,id2 → uuid 배열 (잘못된 값은 버린다) */
export function parseItemsParam(raw: unknown): string[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return [];
  const ids = value.split(",").filter((id) => z.uuid().safeParse(id).success);
  return [...new Set(ids)].slice(0, 20);
}
