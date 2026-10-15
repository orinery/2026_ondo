import { z } from "zod";

import { ITEM_TYPE_VALUES } from "@/lib/constants/taxonomy";
import { tripDayCount } from "@/lib/trip-dates";

/** 여행·일정 항목 입력 검증 — 다이얼로그와 Server Action이 같이 쓴다. DB CHECK 제약과 범위를 맞췄다 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해 주세요");

export const MAX_TRIP_DAYS = 30;

export const tripSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "여행 이름을 입력해 주세요")
      .max(50, "50자 이하로 입력해 주세요"),
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "끝나는 날은 시작하는 날 이후여야 해요",
  })
  .refine((v) => tripDayCount(v.startDate, v.endDate) <= MAX_TRIP_DAYS, {
    path: ["endDate"],
    message: `여행 기간은 최대 ${MAX_TRIP_DAYS}일이에요`,
  });

export type TripInput = z.infer<typeof tripSchema>;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const tripItemSchema = z.object({
  title: z.string().trim().min(1, "장소 이름을 입력해 주세요").max(60, "60자 이하로 입력해 주세요"),
  dayIndex: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_TRIP_DAYS - 1),
  // <input type="time">은 "HH:MM" 또는 빈 값
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간 형식이 올바르지 않아요")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  type: z.enum(ITEM_TYPE_VALUES),
  note: optionalText(200, "메모는 200자 이하로 입력해 주세요"),
  caution: optionalText(60, "주의 메모는 60자 이하로 입력해 주세요"),
});

export type TripItemInput = z.infer<typeof tripItemSchema>;
