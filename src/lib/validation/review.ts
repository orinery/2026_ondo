import { z } from "zod";

/** 리뷰 입력 검증 — 다이얼로그(클라이언트)와 Server Action이 같이 쓴다. DB CHECK 제약과 범위를 맞췄다 */
export const reviewSchema = z.object({
  rating: z.coerce
    .number({ error: "별점을 선택해 주세요" })
    .int()
    .min(1, "별점을 선택해 주세요")
    .max(5, "별점은 5점까지예요"),
  content: z
    .string()
    .trim()
    .min(10, "10자 이상 적어 주세요")
    .max(1000, "1000자 이하로 적어 주세요"),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

/** 사진 1장 제한 — Storage 버킷 설정(5MB, JPEG/PNG/WebP)과 같은 값 */
export const REVIEW_PHOTO = {
  maxBytes: 5 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp"],
  bucket: "review-photos",
} as const;

export function validatePhoto(file: File): string | null {
  if (!(REVIEW_PHOTO.types as readonly string[]).includes(file.type))
    return "JPG, PNG, WebP 사진만 올릴 수 있어요";
  if (file.size > REVIEW_PHOTO.maxBytes) return "사진은 5MB 이하만 올릴 수 있어요";
  return null;
}
