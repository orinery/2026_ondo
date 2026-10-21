CREATE TABLE "settlements" (
	"partner_id" uuid NOT NULL,
	"month" date NOT NULL,
	"item_count" integer NOT NULL,
	"revenue" integer NOT NULL,
	"commission" integer NOT NULL,
	"payout" integer NOT NULL,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_by" uuid,
	CONSTRAINT "settlements_pkey" PRIMARY KEY("partner_id","month"),
	CONSTRAINT "settlements_month_first_day" CHECK (extract(day from "settlements"."month") = 1),
	CONSTRAINT "settlements_amounts" CHECK ("settlements"."payout" = "settlements"."revenue" - "settlements"."commission")
);
--> statement-breakpoint
ALTER TABLE "settlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_settled_by_profiles_id_fk" FOREIGN KEY ("settled_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "settlements_select_own" ON "settlements" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("settlements"."partner_id" = (select public.my_partner_id()));--> statement-breakpoint
CREATE POLICY "settlements_select_admin" ON "settlements" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));