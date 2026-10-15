-- 쇼핑몰 전환 1/3: 여행지(destinations) 기반 구조를 걷어낸다. (drizzle-kit 생성본을 손으로 고침)
--
-- 고친 이유
-- - 생성본은 DROP TABLE ... CASCADE를 먼저 실행해 외래 키가 함께 지워진 뒤, 같은 외래 키를 다시
--   DROP CONSTRAINT 하려다 실패한다. → 외래 키·컬럼을 먼저 지우고 테이블을 마지막에 지운다.
-- - 여행지를 가리키던 찜·리뷰·일정 항목은 새 구조(상품)로 옮길 수 없어 지운다 (사용자 확정: 삭제 후 재시드).
--   계정·프로필·찜 폴더·여행(자유 장소 일정 포함)은 그대로 둔다.

-- ─── 1) 여행지에 묶인 데이터 정리 ────────────────────────────────────────
delete from "likes";--> statement-breakpoint
delete from "reviews";--> statement-breakpoint
delete from "trip_items" where "destination_id" is not null;--> statement-breakpoint

-- ─── 2) 여행지 평점 캐시 트리거 (0001) — 0005에서 상품용으로 다시 만든다 ─────────
drop trigger if exists "reviews_refresh_rating" on "reviews";--> statement-breakpoint
drop function if exists public.refresh_destination_rating();--> statement-breakpoint

-- ─── 3) 외래 키·인덱스·컬럼 ───────────────────────────────────────────────
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_user_destination_unique";--> statement-breakpoint
ALTER TABLE "likes" DROP CONSTRAINT "likes_destination_id_destinations_id_fk";--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_destination_id_destinations_id_fk";--> statement-breakpoint
ALTER TABLE "trip_items" DROP CONSTRAINT "trip_items_destination_id_destinations_id_fk";--> statement-breakpoint
DROP INDEX "reviews_destination_created_idx";--> statement-breakpoint
ALTER TABLE "likes" DROP CONSTRAINT "likes_pkey";--> statement-breakpoint
ALTER TABLE "likes" DROP COLUMN "destination_id";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "destination_id";--> statement-breakpoint
ALTER TABLE "trip_items" DROP COLUMN "destination_id";--> statement-breakpoint

-- ─── 4) 여행지 테이블·enum ────────────────────────────────────────────────
DROP TABLE "destination_images";--> statement-breakpoint
DROP TABLE "destination_itinerary_items";--> statement-breakpoint
DROP TABLE "destinations";--> statement-breakpoint
DROP TYPE "public"."season";--> statement-breakpoint
DROP TYPE "public"."destination_theme";
