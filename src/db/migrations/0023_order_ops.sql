CREATE TABLE "order_memos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_by" uuid DEFAULT auth.uid(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_memos_body" CHECK (char_length(btrim("order_memos"."body")) between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "order_memos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "refund_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"before_amount" integer NOT NULL,
	"after_amount" integer NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_adjustments_amounts" CHECK ("refund_adjustments"."after_amount" > "refund_adjustments"."before_amount")
);
--> statement-breakpoint
ALTER TABLE "refund_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settlement_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"month" date NOT NULL,
	"order_item_id" uuid NOT NULL,
	"revenue_delta" integer NOT NULL,
	"commission_delta" integer NOT NULL,
	"source" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlement_adjustments_month_first_day" CHECK (extract(day from "settlement_adjustments"."month") = 1)
);
--> statement-breakpoint
ALTER TABLE "settlement_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "order_memos" ADD CONSTRAINT "order_memos_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_memos" ADD CONSTRAINT "order_memos_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_adjustments" ADD CONSTRAINT "refund_adjustments_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_adjustments" ADD CONSTRAINT "refund_adjustments_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_adjustments" ADD CONSTRAINT "settlement_adjustments_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_adjustments" ADD CONSTRAINT "settlement_adjustments_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_adjustments" ADD CONSTRAINT "settlement_adjustments_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_memos_order_idx" ON "order_memos" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "refund_adjustments_item_idx" ON "refund_adjustments" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "settlement_adjustments_partner_month_idx" ON "settlement_adjustments" USING btree ("partner_id","month");--> statement-breakpoint
CREATE INDEX "settlement_adjustments_item_idx" ON "settlement_adjustments" USING btree ("order_item_id");--> statement-breakpoint
CREATE POLICY "order_memos_select_admin" ON "order_memos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "order_memos_insert_admin" ON "order_memos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_admin()) and "order_memos"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "refund_adjustments_select_admin" ON "refund_adjustments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "settlement_adjustments_select_own" ON "settlement_adjustments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("settlement_adjustments"."partner_id" = (select public.my_partner_id()));--> statement-breakpoint
CREATE POLICY "settlement_adjustments_select_admin" ON "settlement_adjustments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));