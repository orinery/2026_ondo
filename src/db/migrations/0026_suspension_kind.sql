CREATE TYPE "public"."suspension_kind" AS ENUM('info_fix', 'unsafe', 'partner_suspended');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "suspended_kind" "suspension_kind";