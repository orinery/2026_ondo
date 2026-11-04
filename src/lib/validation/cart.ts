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
    // 회차: 보내지 않으면 상품의 첫 회차 (회차가 하나뿐인 상품·회차 선택 전 화면)
    slotId: z.uuid().optional(),
    useDate: z.iso.date({ error: "이용일을 선택해 주세요" }),
    adultQty: qty,
    childQty: qty,
    // 추가 옵션 — 유효한지(이 상품의 판매 중인 옵션인지)는 DB 트리거가 확인한다
    optionIds: z.array(z.uuid()).max(10).default([]),
  })
  .refine((v) => v.adultQty + v.childQty >= 1, { message: "인원을 1명 이상 선택해 주세요" });

export type CartItemInput = z.infer<typeof cartItemSchema>;

/**
 * 로그인하고 상품 상세로 돌아왔을 때 예약 위젯 선택을 되살리는 주소 값 (Quick Win Q1)
 * /products/{slug}?date=…&slot=…&adult=…&child=…&opt=id,id&resume=buy|cart
 * 값은 화면 초기값으로만 쓴다 — 담기·결제는 사용자가 다시 눌러야 하고, 규칙은 위젯과 DB가 다시 확인한다.
 */
export type BookingResume = {
  date: string;
  slotId: string | null;
  adult: number;
  child: number;
  optionIds: string[];
  mode: "buy" | "cart";
};

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const bookingResumeSchema = z.object({
  date: z.preprocess(first, z.iso.date()),
  slot: z.preprocess(first, z.uuid().optional()).catch(undefined),
  adult: z.preprocess(first, qty),
  child: z.preprocess(first, qty),
  // 잘못된 id는 버리고 나머지만 (어떤 옵션이 이 상품 것인지는 위젯이 다시 거른다)
  opt: z
    .preprocess(first, z.string().optional())
    .transform((s) => (s ? s.split(",").filter((id) => z.uuid().safeParse(id).success) : []))
    .catch([]),
  resume: z.preprocess(first, z.enum(["buy", "cart"])),
});

/** 상세 페이지 searchParams → 되살릴 선택. resume이 없거나 값이 잘못되면 null (날짜만 있으면 기존 ?date= 동작) */
export function parseBookingResume(query: Record<string, unknown>): BookingResume | null {
  const parsed = bookingResumeSchema.safeParse(query);
  if (!parsed.success) return null;
  const { date, slot, adult, child, opt, resume } = parsed.data;
  return { date, slotId: slot ?? null, adult, child, optionIds: opt.slice(0, 10), mode: resume };
}

/** 위젯 선택 → 상세 주소 (로그인으로 보낼 때 next에 담는다) */
export function bookingResumePath(slug: string, sel: BookingResume) {
  const params = new URLSearchParams({
    date: sel.date,
    adult: String(sel.adult),
    child: String(sel.child),
    resume: sel.mode,
  });
  if (sel.slotId) params.set("slot", sel.slotId);
  if (sel.optionIds.length > 0) params.set("opt", sel.optionIds.join(","));
  return `/products/${slug}?${params.toString()}`;
}
