CREATE TYPE "public"."option_unit" AS ENUM('per_booking', 'per_person');--> statement-breakpoint
CREATE TYPE "public"."order_item_status" AS ENUM('pending', 'confirmed', 'used', 'rejected', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "order_item_options" (
	"order_item_id" uuid NOT NULL,
	"option_id" uuid,
	"name" text NOT NULL,
	"unit" "option_unit" NOT NULL,
	"unit_price" integer NOT NULL,
	"qty" smallint NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "order_item_options_pkey" PRIMARY KEY("order_item_id","name")
);
--> statement-breakpoint
ALTER TABLE "order_item_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"unit" "option_unit" DEFAULT 'per_booking' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "product_options_product_name_unique" UNIQUE("product_id","name"),
	CONSTRAINT "product_options_name_length" CHECK (char_length("product_options"."name") between 1 and 30),
	CONSTRAINT "product_options_price" CHECK ("product_options"."price" between 0 and 1000000)
);
--> statement-breakpoint
ALTER TABLE "product_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"start_time" time,
	"capacity" smallint DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_slots_product_time_unique" UNIQUE NULLS NOT DISTINCT("product_id","start_time"),
	CONSTRAINT "product_slots_capacity" CHECK ("product_slots"."capacity" between 1 and 999)
);
--> statement-breakpoint
ALTER TABLE "product_slots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "slot_inventory" (
	"slot_id" uuid NOT NULL,
	"use_date" date NOT NULL,
	"capacity" smallint,
	"closed" boolean DEFAULT false NOT NULL,
	"adult_price" integer,
	"child_price" integer,
	"booked" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "slot_inventory_pkey" PRIMARY KEY("slot_id","use_date"),
	CONSTRAINT "slot_inventory_capacity" CHECK ("slot_inventory"."capacity" is null or "slot_inventory"."capacity" between 0 and 999),
	CONSTRAINT "slot_inventory_booked" CHECK ("slot_inventory"."booked" >= 0),
	CONSTRAINT "slot_inventory_adult_price" CHECK ("slot_inventory"."adult_price" is null or "slot_inventory"."adult_price" > 0),
	CONSTRAINT "slot_inventory_child_price" CHECK ("slot_inventory"."child_price" is null or "slot_inventory"."child_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "slot_inventory" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- ⚠ 장바구니 중복 기준 변경: (사용자, 상품, 날짜) → (사용자, 회차, 날짜). 새 제약은 아래에서 추가한다
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_user_product_date_unique";--> statement-breakpoint
-- [수정] 기존 행이 있어 NULL 허용으로 추가하고, 0012에서 값을 채운 뒤 NOT NULL로 바꾼다
ALTER TABLE "cart_items" ADD COLUMN "slot_id" uuid;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "option_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "status" "order_item_status" DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
-- [수정] 기존 행이 있어 NULL 허용으로 추가하고, 0012에서 값을 채운 뒤 NOT NULL로 바꾼다
ALTER TABLE "order_items" ADD COLUMN "slot_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "start_time" time;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "options_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- [수정] 기존 행이 있어 NULL 허용으로 추가하고, 0012에서 값을 채운 뒤 NOT NULL로 바꾼다
ALTER TABLE "order_items" ADD COLUMN "partner_id" uuid;--> statement-breakpoint
-- [수정] 기존 행이 있어 NULL 허용으로 추가하고, 0012에서 값을 채운 뒤 NOT NULL로 바꾼다
ALTER TABLE "order_items" ADD COLUMN "commission_rate" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "voucher_code" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "confirm_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "reject_reason" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_option_id_product_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_slots" ADD CONSTRAINT "product_slots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_inventory" ADD CONSTRAINT "slot_inventory_slot_id_product_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."product_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_slot_id_product_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."product_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_slot_id_product_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."product_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_partner_date_idx" ON "order_items" USING btree ("partner_id","use_date");--> statement-breakpoint
CREATE INDEX "order_items_pending_deadline_idx" ON "order_items" USING btree ("confirm_deadline") WHERE "order_items"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_slot_date_unique" UNIQUE("user_id","slot_id","use_date");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_voucher_unique" UNIQUE("voucher_code");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_options_amount" CHECK ("order_items"."options_amount" >= 0);--> statement-breakpoint
CREATE POLICY "order_items_select_partner" ON "order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("order_items"."partner_id" = (select public.my_partner_id()));--> statement-breakpoint
CREATE POLICY "order_items_select_admin" ON "order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "orders_select_admin" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "order_item_options_select_visible" ON "order_item_options" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.order_items oi where oi.id = "order_item_options"."order_item_id"));--> statement-breakpoint
CREATE POLICY "product_options_select_public" ON "product_options" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "product_options_insert_partner" ON "product_options" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.products p where p.id = "product_options"."product_id" and p.partner_id = (select public.my_partner_id())));--> statement-breakpoint
CREATE POLICY "product_options_update_partner" ON "product_options" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.products p where p.id = "product_options"."product_id" and p.partner_id = (select public.my_partner_id()))) WITH CHECK (exists (select 1 from public.products p where p.id = "product_options"."product_id" and p.partner_id = (select public.my_partner_id())));--> statement-breakpoint
CREATE POLICY "product_options_delete_partner" ON "product_options" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.products p where p.id = "product_options"."product_id" and p.partner_id = (select public.my_partner_id())));--> statement-breakpoint
CREATE POLICY "product_slots_select_public" ON "product_slots" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "product_slots_insert_partner" ON "product_slots" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.products p where p.id = "product_slots"."product_id" and p.partner_id = (select public.my_partner_id())));--> statement-breakpoint
CREATE POLICY "product_slots_update_partner" ON "product_slots" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.products p where p.id = "product_slots"."product_id" and p.partner_id = (select public.my_partner_id()))) WITH CHECK (exists (select 1 from public.products p where p.id = "product_slots"."product_id" and p.partner_id = (select public.my_partner_id())));--> statement-breakpoint
CREATE POLICY "product_slots_delete_partner" ON "product_slots" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.products p where p.id = "product_slots"."product_id" and p.partner_id = (select public.my_partner_id())));--> statement-breakpoint
CREATE POLICY "slot_inventory_select_public" ON "slot_inventory" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "slot_inventory_insert_partner" ON "slot_inventory" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.product_slots s join public.products p on p.id = s.product_id
                  where s.id = "slot_inventory"."slot_id" and p.partner_id = (select public.my_partner_id())));--> statement-breakpoint
CREATE POLICY "slot_inventory_update_partner" ON "slot_inventory" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.product_slots s join public.products p on p.id = s.product_id
                  where s.id = "slot_inventory"."slot_id" and p.partner_id = (select public.my_partner_id()))) WITH CHECK (exists (select 1 from public.product_slots s join public.products p on p.id = s.product_id
                  where s.id = "slot_inventory"."slot_id" and p.partner_id = (select public.my_partner_id())));--> statement-breakpoint
CREATE POLICY "slot_inventory_delete_partner" ON "slot_inventory" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.product_slots s join public.products p on p.id = s.product_id
                  where s.id = "slot_inventory"."slot_id" and p.partner_id = (select public.my_partner_id())));