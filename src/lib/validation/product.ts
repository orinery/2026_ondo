import { z } from "zod";

import {
  CATEGORY_VALUES,
  CONFIRMATION_MODE_VALUES,
  OPTION_UNIT_VALUES,
  THEME_VALUES,
  USER_ITEM_TYPE_VALUES,
} from "@/lib/constants/taxonomy";
import { publicEnv } from "@/lib/env";

/**
 * 파트너 상품 등록·수정 입력 검증 — 상품 폼(클라이언트)과 saveProduct Server Action이 같이 쓴다.
 * 범위는 DB CHECK 제약·save_product 함수의 검사와 맞췄다 (DB가 최종 판단).
 */

/** 상품 사진은 이 사이트 Storage(상품 사진 버킷)에 올린 것만 — 다른 주소는 next/image가 거부한다 */
export const PRODUCT_IMAGE = {
  bucket: "product-images",
  maxBytes: 5 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp"],
  max: 8,
} as const;
const STORAGE_PREFIX = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGE.bucket}/`;
// 시드 상품은 Unsplash 사진을 쓴다 (수정할 때 그대로 둘 수 있게 허용)
const isAllowedImage = (url: string) =>
  url.startsWith(STORAGE_PREFIX) || url.startsWith("https://images.unsplash.com/");

const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label}을(를) 입력해 주세요`)
    .max(max, `${label}은(는) ${max}자 이하로 입력해 주세요`);
const lines = (maxItems: number, maxLength: number) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간은 09:30 형식으로 입력해 주세요");
const won = (min: number) =>
  z.coerce.number().int("원 단위 정수로 입력해 주세요").min(min).max(10_000_000);

export const productFormSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "영문 소문자·숫자·하이픈(-)만 쓸 수 있어요")
      .min(3, "3자 이상 입력해 주세요")
      .max(60),
    cityId: z.uuid({ error: "도시를 골라 주세요" }),
    category: z.enum(CATEGORY_VALUES),
    theme: z.enum(THEME_VALUES),
    title: text(60, "상품명"),
    summary: text(120, "한 줄 소개"),
    description: text(2000, "상품 소개"),
    highlights: lines(8, 80),
    images: z
      .array(
        z.object({
          url: z.string().refine(isAllowedImage, "이 사이트에 올린 사진만 쓸 수 있어요"),
          alt: text(120, "사진 설명"),
        }),
      )
      .min(1, "사진을 1장 이상 올려 주세요")
      .max(PRODUCT_IMAGE.max),
    adultPrice: won(1),
    childPrice: won(0).nullable(), // null = 성인 전용
    listAdultPrice: won(1).nullable(), // 정가 (할인 표시)
    operatingDays: z
      .array(z.number().int().min(1).max(7))
      .min(1, "운영 요일을 하루 이상 골라 주세요")
      .refine((days) => new Set(days).size === days.length),
    cutoffDays: z.coerce.number().int().min(0).max(30),
    maxQty: z.coerce.number().int().min(1).max(20),
    durationText: text(30, "소요 시간"),
    includes: lines(12, 120),
    excludes: lines(12, 120),
    usageInfo: lines(12, 120),
    meetingPoint: text(100, "만나는 장소"),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    cancelPolicy: z.string().min(1, "취소 규정을 골라 주세요"),
    unavailableReason: z.string().trim().max(60).nullable(), // 값이 있으면 판매 일시 중단
    confirmationMode: z.enum(CONFIRMATION_MODE_VALUES),
    publish: z.boolean(),
    slots: z
      .array(
        z.object({
          startTime: z.union([z.literal(""), hhmm]), // "" = 시간 없는 회차(종일권)
          capacity: z.coerce.number().int().min(1, "정원은 1명 이상").max(999),
        }),
      )
      .min(1, "회차를 1개 이상 넣어 주세요")
      .max(6, "회차는 6개까지예요")
      .refine(
        (s) => new Set(s.map((x) => x.startTime)).size === s.length,
        "같은 시간 회차가 있어요",
      ),
    options: z
      .array(
        z.object({
          name: text(30, "옵션 이름"),
          price: z.coerce.number().int().min(0).max(1_000_000),
          unit: z.enum(OPTION_UNIT_VALUES),
        }),
      )
      .max(10, "옵션은 10개까지예요")
      .refine((o) => new Set(o.map((x) => x.name)).size === o.length, "같은 이름 옵션이 있어요"),
    itinerary: z
      .array(
        z.object({
          time: z.union([z.literal(""), hhmm]),
          title: text(60, "일정 제목"),
          note: z.string().trim().max(200),
          type: z.enum(USER_ITEM_TYPE_VALUES),
          caution: z.string().trim().max(60),
        }),
      )
      .max(15, "진행 일정은 15개까지예요"),
  })
  .refine((v) => v.listAdultPrice === null || v.listAdultPrice > v.adultPrice, {
    path: ["listAdultPrice"],
    message: "정가는 판매가보다 커야 해요",
  })
  .refine((v) => v.confirmationMode === "instant" || v.cutoffDays >= 1, {
    path: ["cutoffDays"],
    message: "파트너 확정 상품은 이용 1일 전 이상으로 마감해야 확정할 시간이 생겨요",
  });

export type ProductFormInput = z.infer<typeof productFormSchema>;

/** 날짜별 재고 일괄 수정 */
export const inventoryRangeSchema = z
  .object({
    slotId: z.uuid(),
    from: z.iso.date(),
    to: z.iso.date(),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7), // 비면 모든 요일
    mode: z.enum(["set", "reset"]), // reset = 기본값으로 되돌리기
    capacity: z.coerce.number().int().min(0).max(999).nullable(),
    closed: z.boolean(),
    adultPrice: z.coerce.number().int().min(1).max(10_000_000).nullable(),
    childPrice: z.coerce.number().int().min(0).max(10_000_000).nullable(),
  })
  .refine((v) => v.to >= v.from, { path: ["to"], message: "끝나는 날이 시작일보다 빨라요" });

export type InventoryRangeInput = z.infer<typeof inventoryRangeSchema>;
