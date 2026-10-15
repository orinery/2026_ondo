import { z } from "zod";

/**
 * 장바구니 입력 검증 — 예약 위젯·장바구니 화면(클라이언트)과 Server Action이 같이 쓴다.
 * 범위는 DB CHECK(cart_items_qty)·max_qty 상한(20)과 맞췄다.
 * 상품별 규칙(운영 요일·마감·최대 인원)은 DB 트리거가 최종 판단한다.
 */
const qty = z.coerce.number().int().min(0).max(20);

export const cartQuantitySchema = z
  .object({ adultQty: qty, childQty: qty })
  .refine((v) => v.adultQty + v.childQty >= 1, { message: "인원을 1명 이상 선택해 주세요" });

export const cartItemSchema = z
  .object({
    productId: z.uuid(),
    useDate: z.iso.date({ error: "이용일을 선택해 주세요" }),
    adultQty: qty,
    childQty: qty,
  })
  .refine((v) => v.adultQty + v.childQty >= 1, { message: "인원을 1명 이상 선택해 주세요" });

export type CartItemInput = z.infer<typeof cartItemSchema>;
