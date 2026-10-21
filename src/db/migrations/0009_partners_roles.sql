CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."confirmation_mode" AS ENUM('instant', 'manual');--> statement-breakpoint
CREATE TYPE "public"."partner_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'partner', 'admin');--> statement-breakpoint
CREATE TABLE "partner_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_email" text NOT NULL,
	"intro" text NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_applications_business_name" CHECK (char_length("partner_applications"."business_name") between 1 and 40),
	CONSTRAINT "partner_applications_contact_name" CHECK (char_length("partner_applications"."contact_name") between 1 and 30),
	CONSTRAINT "partner_applications_contact_phone" CHECK ("partner_applications"."contact_phone" ~ '^0[0-9]{1,2}-[0-9]{3,4}-[0-9]{4}$'),
	CONSTRAINT "partner_applications_contact_email" CHECK (char_length("partner_applications"."contact_email") <= 254 and "partner_applications"."contact_email" like '%_@_%'),
	CONSTRAINT "partner_applications_intro" CHECK (char_length("partner_applications"."intro") between 10 and 500),
	CONSTRAINT "partner_applications_reject_reason" CHECK ("partner_applications"."reject_reason" is null or char_length("partner_applications"."reject_reason") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "partner_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_email" text NOT NULL,
	"intro" text NOT NULL,
	"status" "partner_status" DEFAULT 'active' NOT NULL,
	"commission_rate" numeric(4, 2) DEFAULT '15' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_owner_unique" UNIQUE("owner_user_id"),
	CONSTRAINT "partners_name_length" CHECK (char_length("partners"."name") between 1 and 40),
	CONSTRAINT "partners_commission_rate" CHECK ("partners"."commission_rate" between 0 and 50)
);
--> statement-breakpoint
ALTER TABLE "partners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- [수정] 기존 상품에는 파트너가 없으므로 NULL 허용으로 추가하고, 0010에서 "여운 직영"으로 채운 뒤 NOT NULL로 바꾼다
ALTER TABLE "products" ADD COLUMN "partner_id" uuid DEFAULT public.my_partner_id();--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "confirmation_mode" "confirmation_mode" DEFAULT 'instant' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "role" "user_role" DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_owner_user_id_profiles_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_applications_pending_unique" ON "partner_applications" USING btree ("user_id") WHERE "partner_applications"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "partner_applications_status_idx" ON "partner_applications" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_partner_idx" ON "products" USING btree ("partner_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_manual_cutoff" CHECK ("products"."confirmation_mode" = 'instant' or "products"."cutoff_days" >= 1);--> statement-breakpoint
CREATE POLICY "products_select_partner_own" ON "products" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("products"."partner_id" = (select public.my_partner_id()));--> statement-breakpoint
CREATE POLICY "products_select_admin" ON "products" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "products_insert_partner" ON "products" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("products"."partner_id" = (select public.my_partner_id()));--> statement-breakpoint
CREATE POLICY "products_update_partner" ON "products" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("products"."partner_id" = (select public.my_partner_id())) WITH CHECK ("products"."partner_id" = (select public.my_partner_id()));--> statement-breakpoint
CREATE POLICY "partner_applications_insert_own" ON "partner_applications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("partner_applications"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "partner_applications_select_own" ON "partner_applications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("partner_applications"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "partner_applications_select_admin" ON "partner_applications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "partners_select_own" ON "partners" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("partners"."owner_user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "partners_select_admin" ON "partners" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
ALTER POLICY "products_select_public" ON "products" TO anon,authenticated USING ("products"."published_at" is not null);