CREATE TABLE "funnel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"session_id" uuid NOT NULL,
	"product_id" uuid,
	"device" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funnel_events_name" CHECK ("funnel_events"."name" in ('view_item', 'start_booking', 'login_wall', 'add_to_cart', 'begin_checkout', 'purchase')),
	CONSTRAINT "funnel_events_device" CHECK ("funnel_events"."device" in ('mobile', 'desktop'))
);
--> statement-breakpoint
ALTER TABLE "funnel_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "funnel_events_created_idx" ON "funnel_events" USING btree ("created_at");--> statement-breakpoint
CREATE POLICY "funnel_events_insert_any" ON "funnel_events" AS PERMISSIVE FOR INSERT TO "anon", "authenticated" WITH CHECK (true);