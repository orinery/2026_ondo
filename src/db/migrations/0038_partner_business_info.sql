-- 판매자 신원 정보 1/2 (Quick Win Q3): partners·partner_applications에 대표자·사업자등록번호·사업장 주소·여행업 등록번호
-- 생성본은 NOT NULL 컬럼을 바로 추가해 기존 행이 있으면 실패한다 → 빈 컬럼으로 추가 → 값 채우기 → NOT NULL 순서로 고쳤다.
-- 값: 시드 파트너 4곳은 포트폴리오 예시 값(화면에 "예시"로 표시), 그 밖의 기존 행은 "입력 필요" 자리 값.
ALTER TABLE "partner_applications" ADD COLUMN "representative" text;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD COLUMN "business_reg_no" text;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD COLUMN "business_address" text;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD COLUMN "tourism_license_no" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "representative" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "business_reg_no" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "business_address" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "tourism_license_no" text;--> statement-breakpoint
-- 시드 파트너 (src/db/seed-data.ts SEED_PARTNERS와 같은 값)
UPDATE "partners" AS p SET
  "representative" = v.representative,
  "business_reg_no" = v.reg_no,
  "business_address" = v.address,
  "tourism_license_no" = v.license
FROM (VALUES
  ('00000000-0000-4000-8000-000000000001'::uuid, '김여운', '123-45-00001', '서울특별시 중구 예시로 1', '제2026-000001호'),
  ('00000000-0000-4000-8000-000000000011'::uuid, '박하루', '123-45-00011', '서울특별시 마포구 예시로 11', '제2026-000011호'),
  ('00000000-0000-4000-8000-000000000012'::uuid, '정모노', '123-45-00012', '부산광역시 해운대구 예시로 12', '제2026-000012호'),
  ('00000000-0000-4000-8000-000000000013'::uuid, '최유키', '123-45-00013', '서울특별시 강남구 예시로 13', NULL)
) AS v(id, representative, reg_no, address, license)
WHERE p.id = v.id;--> statement-breakpoint
UPDATE "partners" SET "representative" = '입력 필요', "business_reg_no" = '000-00-00000', "business_address" = '입력 필요'
WHERE "representative" IS NULL;--> statement-breakpoint
UPDATE "partner_applications" SET "representative" = '입력 필요', "business_reg_no" = '000-00-00000', "business_address" = '입력 필요'
WHERE "representative" IS NULL;--> statement-breakpoint
ALTER TABLE "partner_applications" ALTER COLUMN "representative" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_applications" ALTER COLUMN "business_reg_no" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_applications" ALTER COLUMN "business_address" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "representative" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "business_reg_no" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "business_address" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_representative" CHECK (char_length("partner_applications"."representative") between 1 and 30);--> statement-breakpoint
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_business_reg_no" CHECK ("partner_applications"."business_reg_no" ~ '^[0-9]{3}-[0-9]{2}-[0-9]{5}$');--> statement-breakpoint
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_business_address" CHECK (char_length("partner_applications"."business_address") between 1 and 100);--> statement-breakpoint
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_tourism_license_no" CHECK ("partner_applications"."tourism_license_no" is null or char_length("partner_applications"."tourism_license_no") between 1 and 30);--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_representative" CHECK (char_length("partners"."representative") between 1 and 30);--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_business_reg_no" CHECK ("partners"."business_reg_no" ~ '^[0-9]{3}-[0-9]{2}-[0-9]{5}$');--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_business_address" CHECK (char_length("partners"."business_address") between 1 and 100);--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_tourism_license_no" CHECK ("partners"."tourism_license_no" is null or char_length("partners"."tourism_license_no") between 1 and 30);
