-- 쇼핑몰 전환 2/3: 상품·장바구니·주문 테이블 (drizzle-kit 생성본을 손으로 고침)
-- 고친 것
-- - likes의 기본 키를 product_id 컬럼을 추가한 "뒤"에 만들도록 순서 변경 (생성본은 컬럼보다 먼저 만들어 실패)
-- - reviews_insert_own 정책 변경은 has_used_product 함수가 있어야 하므로 0005로 옮김
CREATE TYPE "public"."product_category" AS ENUM('tour', 'ticket');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."product_theme" AS ENUM('sea', 'city', 'nature', 'culture');--> statement-breakpoint
ALTER TYPE "public"."itinerary_item_type" ADD VALUE 'booking';--> statement-breakpoint
CREATE TABLE "cancellation_policies" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cancellation_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cancellation_policy_tiers" (
	"policy_code" text NOT NULL,
	"days_before" smallint NOT NULL,
	"refund_rate" smallint NOT NULL,
	CONSTRAINT "cancellation_policy_tiers_pkey" PRIMARY KEY("policy_code","days_before"),
	CONSTRAINT "cancellation_policy_tiers_days" CHECK ("cancellation_policy_tiers"."days_before" between 0 and 60),
	CONSTRAINT "cancellation_policy_tiers_rate" CHECK ("cancellation_policy_tiers"."refund_rate" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "cancellation_policy_tiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"product_id" uuid NOT NULL,
	"use_date" date NOT NULL,
	"adult_qty" smallint DEFAULT 1 NOT NULL,
	"child_qty" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_user_product_date_unique" UNIQUE("user_id","product_id","use_date"),
	CONSTRAINT "cart_items_qty" CHECK ("cart_items"."adult_qty" >= 0 and "cart_items"."child_qty" >= 0 and "cart_items"."adult_qty" + "cart_items"."child_qty" >= 1)
);
--> statement-breakpoint
ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_en" text NOT NULL,
	"summary" text NOT NULL,
	"image_url" text NOT NULL,
	"image_alt" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "cities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "cities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_title" text NOT NULL,
	"use_date" date NOT NULL,
	"adult_qty" smallint NOT NULL,
	"child_qty" smallint NOT NULL,
	"adult_price" integer NOT NULL,
	"child_price" integer,
	"subtotal" integer NOT NULL,
	"cancel_policy" text NOT NULL,
	"refund_amount" integer,
	CONSTRAINT "order_items_qty" CHECK ("order_items"."adult_qty" >= 0 and "order_items"."child_qty" >= 0),
	CONSTRAINT "order_items_subtotal" CHECK ("order_items"."subtotal" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" text NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'paid' NOT NULL,
	"booker_name" text NOT NULL,
	"booker_email" text NOT NULL,
	"booker_phone" text NOT NULL,
	"total_amount" integer NOT NULL,
	"refund_amount" integer,
	"payment_method" text DEFAULT 'demo' NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"policy_agreed_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no"),
	CONSTRAINT "orders_user_idempotency_unique" UNIQUE("user_id","idempotency_key"),
	CONSTRAINT "orders_booker_name" CHECK (char_length("orders"."booker_name") between 1 and 30),
	CONSTRAINT "orders_booker_email" CHECK (char_length("orders"."booker_email") <= 254 and "orders"."booker_email" like '%_@_%'),
	CONSTRAINT "orders_booker_phone" CHECK ("orders"."booker_phone" ~ '^01[016789]-[0-9]{3,4}-[0-9]{4}$'),
	CONSTRAINT "orders_total_amount" CHECK ("orders"."total_amount" > 0),
	CONSTRAINT "orders_refund_amount" CHECK ("orders"."refund_amount" is null or "orders"."refund_amount" between 0 and "orders"."total_amount")
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "product_images_position_unique" UNIQUE("product_id","position")
);
--> statement-breakpoint
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_itinerary_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"time" time,
	"title" text NOT NULL,
	"note" text,
	"type" "itinerary_item_type" NOT NULL,
	"caution" text,
	CONSTRAINT "product_itinerary_items_order_unique" UNIQUE("product_id","position")
);
--> statement-breakpoint
ALTER TABLE "product_itinerary_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"city_id" uuid NOT NULL,
	"category" "product_category" NOT NULL,
	"theme" "product_theme" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"highlights" text[] DEFAULT '{}' NOT NULL,
	"image_url" text NOT NULL,
	"image_alt" text NOT NULL,
	"adult_price" integer NOT NULL,
	"child_price" integer,
	"list_adult_price" integer,
	"operating_days" smallint[] NOT NULL,
	"cutoff_days" smallint DEFAULT 1 NOT NULL,
	"max_qty" smallint DEFAULT 10 NOT NULL,
	"start_time" time,
	"duration_text" text NOT NULL,
	"includes" text[] DEFAULT '{}' NOT NULL,
	"excludes" text[] DEFAULT '{}' NOT NULL,
	"usage_info" text[] DEFAULT '{}' NOT NULL,
	"meeting_point" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"cancel_policy" text NOT NULL,
	"unavailable_reason" text,
	"recommend_rank" smallint,
	"rating_avg" numeric(2, 1) DEFAULT '0' NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_title_length" CHECK (char_length("products"."title") between 1 and 60),
	CONSTRAINT "products_adult_price" CHECK ("products"."adult_price" > 0),
	CONSTRAINT "products_child_price" CHECK ("products"."child_price" is null or "products"."child_price" >= 0),
	CONSTRAINT "products_list_price" CHECK ("products"."list_adult_price" is null or "products"."list_adult_price" > "products"."adult_price"),
	CONSTRAINT "products_operating_days" CHECK (cardinality("products"."operating_days") >= 1 and "products"."operating_days" <@ '{1,2,3,4,5,6,7}'::smallint[]),
	CONSTRAINT "products_cutoff_days" CHECK ("products"."cutoff_days" between 0 and 30),
	CONSTRAINT "products_max_qty" CHECK ("products"."max_qty" between 1 and 20),
	CONSTRAINT "products_latitude" CHECK ("products"."latitude" between -90 and 90),
	CONSTRAINT "products_longitude" CHECK ("products"."longitude" between -180 and 180)
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "likes" ADD COLUMN "product_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_pkey" PRIMARY KEY("user_id","product_id");--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "product_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_items" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "trip_items" ADD COLUMN "order_item_id" uuid;--> statement-breakpoint
ALTER TABLE "cancellation_policy_tiers" ADD CONSTRAINT "cancellation_policy_tiers_policy_code_cancellation_policies_code_fk" FOREIGN KEY ("policy_code") REFERENCES "public"."cancellation_policies"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_cancel_policy_cancellation_policies_code_fk" FOREIGN KEY ("cancel_policy") REFERENCES "public"."cancellation_policies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_itinerary_items" ADD CONSTRAINT "product_itinerary_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_cancel_policy_cancellation_policies_code_fk" FOREIGN KEY ("cancel_policy") REFERENCES "public"."cancellation_policies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_date_idx" ON "order_items" USING btree ("product_id","use_date");--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "products_city_idx" ON "products" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "products_category_theme_idx" ON "products" USING btree ("category","theme");--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_product_created_idx" ON "reviews" USING btree ("product_id","created_at");--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_product_unique" UNIQUE("user_id","product_id");--> statement-breakpoint
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_order_item_unique" UNIQUE("order_item_id");--> statement-breakpoint
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_booking_link" CHECK (("trip_items"."type"::text = 'booking') = ("trip_items"."order_item_id" is not null));--> statement-breakpoint
CREATE POLICY "trip_items_delete_not_booking" ON "trip_items" AS RESTRICTIVE FOR DELETE TO "authenticated" USING ("trip_items"."order_item_id" is null);--> statement-breakpoint
CREATE POLICY "cancellation_policies_select_public" ON "cancellation_policies" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "cancellation_policy_tiers_select_public" ON "cancellation_policy_tiers" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "cart_items_owner_all" ON "cart_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("cart_items"."user_id" = (select auth.uid())) WITH CHECK ("cart_items"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "cities_select_public" ON "cities" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "order_items_select_own" ON "order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.orders o where o.id = "order_items"."order_id" and o.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "orders_select_own" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("orders"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "product_images_select_public" ON "product_images" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "product_itinerary_items_select_public" ON "product_itinerary_items" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "products_select_public" ON "products" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);
