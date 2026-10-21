CREATE TYPE "public"."report_reason" AS ENUM('spam', 'abuse', 'irrelevant', 'privacy', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TABLE "review_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reporter_id" uuid DEFAULT auth.uid() NOT NULL,
	"reason" "report_reason" NOT NULL,
	"detail" text,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_reports_review_reporter_unique" UNIQUE("review_id","reporter_id"),
	CONSTRAINT "review_reports_detail" CHECK ("review_reports"."detail" is null or char_length("review_reports"."detail") <= 300)
);
--> statement-breakpoint
ALTER TABLE "review_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_handled_by_profiles_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_reports_status_idx" ON "review_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE POLICY "reviews_hide_from_anon" ON "reviews" AS RESTRICTIVE FOR SELECT TO "anon" USING ("reviews"."hidden_at" is null);--> statement-breakpoint
CREATE POLICY "reviews_hide_from_others" ON "reviews" AS RESTRICTIVE FOR SELECT TO "authenticated" USING ("reviews"."hidden_at" is null or "reviews"."user_id" = (select auth.uid()) or (select public.is_admin()));--> statement-breakpoint
CREATE POLICY "review_reports_insert_own" ON "review_reports" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("review_reports"."reporter_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "review_reports_select_own" ON "review_reports" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("review_reports"."reporter_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "review_reports_select_admin" ON "review_reports" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));