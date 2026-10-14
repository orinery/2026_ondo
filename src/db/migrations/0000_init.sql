CREATE TYPE "public"."itinerary_item_type" AS ENUM('move', 'sight', 'food');--> statement-breakpoint
CREATE TYPE "public"."season" AS ENUM('spring', 'summer', 'fall', 'winter');--> statement-breakpoint
CREATE TYPE "public"."destination_theme" AS ENUM('sea', 'city', 'nature', 'culture');--> statement-breakpoint
CREATE TABLE "destination_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "destination_images_position_unique" UNIQUE("destination_id","position")
);
--> statement-breakpoint
ALTER TABLE "destination_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "destination_itinerary_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination_id" uuid NOT NULL,
	"day_number" smallint NOT NULL,
	"position" smallint NOT NULL,
	"time" time,
	"title" text NOT NULL,
	"note" text,
	"type" "itinerary_item_type" NOT NULL,
	"caution" text,
	CONSTRAINT "destination_itinerary_items_order_unique" UNIQUE("destination_id","day_number","position"),
	CONSTRAINT "destination_itinerary_items_day" CHECK ("destination_itinerary_items"."day_number" >= 1)
);
--> statement-breakpoint
ALTER TABLE "destination_itinerary_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_en" text NOT NULL,
	"country" text NOT NULL,
	"theme" "destination_theme" NOT NULL,
	"season" "season" NOT NULL,
	"best_seasons" "season"[] NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text NOT NULL,
	"image_alt" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"flight_info" text,
	"time_difference" text,
	"currency" text,
	"unavailable_reason" text,
	"rating_avg" numeric(2, 1) DEFAULT '0' NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "destinations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "destinations_season_in_best" CHECK ("destinations"."season" = any("destinations"."best_seasons")),
	CONSTRAINT "destinations_latitude" CHECK ("destinations"."latitude" between -90 and 90),
	CONSTRAINT "destinations_longitude" CHECK ("destinations"."longitude" between -180 and 180)
);
--> statement-breakpoint
ALTER TABLE "destinations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "like_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "like_folders_user_name_unique" UNIQUE("user_id","name"),
	CONSTRAINT "like_folders_name_length" CHECK (char_length("like_folders"."name") between 1 and 20)
);
--> statement-breakpoint
ALTER TABLE "like_folders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "likes" (
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"destination_id" uuid NOT NULL,
	"folder_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "likes_pkey" PRIMARY KEY("user_id","destination_id")
);
--> statement-breakpoint
ALTER TABLE "likes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"terms_agreed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_display_name_length" CHECK (char_length("profiles"."display_name") between 1 and 30)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"destination_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"content" text NOT NULL,
	"photo_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_user_destination_unique" UNIQUE("user_id","destination_id"),
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5),
	CONSTRAINT "reviews_content_length" CHECK (char_length("reviews"."content") between 10 and 1000)
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"day_index" smallint NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"time" time,
	"type" "itinerary_item_type" DEFAULT 'sight' NOT NULL,
	"note" text,
	"caution" text,
	"destination_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_items_day_index" CHECK ("trip_items"."day_index" between 0 and 29),
	CONSTRAINT "trip_items_title_length" CHECK (char_length("trip_items"."title") between 1 and 60),
	CONSTRAINT "trip_items_note_length" CHECK ("trip_items"."note" is null or char_length("trip_items"."note") <= 200),
	CONSTRAINT "trip_items_caution_length" CHECK ("trip_items"."caution" is null or char_length("trip_items"."caution") <= 60)
);
--> statement-breakpoint
ALTER TABLE "trip_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"title" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_title_length" CHECK (char_length("trips"."title") between 1 and 50),
	CONSTRAINT "trips_date_order" CHECK ("trips"."end_date" >= "trips"."start_date"),
	CONSTRAINT "trips_max_days" CHECK ("trips"."end_date" - "trips"."start_date" <= 29)
);
--> statement-breakpoint
ALTER TABLE "trips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "destination_images" ADD CONSTRAINT "destination_images_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_itinerary_items" ADD CONSTRAINT "destination_itinerary_items_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "like_folders" ADD CONSTRAINT "like_folders_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_folder_id_like_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."like_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "destinations_theme_idx" ON "destinations" USING btree ("theme");--> statement-breakpoint
CREATE INDEX "destinations_best_seasons_idx" ON "destinations" USING gin ("best_seasons");--> statement-breakpoint
CREATE INDEX "likes_folder_idx" ON "likes" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "reviews_destination_created_idx" ON "reviews" USING btree ("destination_id","created_at");--> statement-breakpoint
CREATE INDEX "trip_items_order_idx" ON "trip_items" USING btree ("trip_id","day_index","position");--> statement-breakpoint
CREATE INDEX "trips_user_idx" ON "trips" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "destination_images_select_public" ON "destination_images" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "destination_itinerary_items_select_public" ON "destination_itinerary_items" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "destinations_select_public" ON "destinations" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "like_folders_owner_all" ON "like_folders" AS PERMISSIVE FOR ALL TO "authenticated" USING ("like_folders"."user_id" = (select auth.uid())) WITH CHECK ("like_folders"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "likes_owner_all" ON "likes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("likes"."user_id" = (select auth.uid())) WITH CHECK ("likes"."user_id" = (select auth.uid()) and ("likes"."folder_id" is null or exists (
        select 1 from public.like_folders f where f.id = "likes"."folder_id" and f.user_id = (select auth.uid())
      )));--> statement-breakpoint
CREATE POLICY "profiles_select_public" ON "profiles" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."id" = (select auth.uid())) WITH CHECK ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "reviews_select_public" ON "reviews" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "reviews_insert_own" ON "reviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("reviews"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "reviews_update_own" ON "reviews" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("reviews"."user_id" = (select auth.uid())) WITH CHECK ("reviews"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "reviews_delete_own" ON "reviews" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("reviews"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "trip_items_owner_all" ON "trip_items" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from public.trips tr where tr.id = "trip_items"."trip_id" and tr.user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from public.trips tr where tr.id = "trip_items"."trip_id" and tr.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "trips_owner_all" ON "trips" AS PERMISSIVE FOR ALL TO "authenticated" USING ("trips"."user_id" = (select auth.uid())) WITH CHECK ("trips"."user_id" = (select auth.uid()));