CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_role" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"order_id" uuid,
	"action" text NOT NULL,
	"reason_code" text,
	"reason" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_actor_role" CHECK ("audit_logs"."actor_role" in ('customer', 'partner', 'admin', 'system'))
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_order_idx" ON "audit_logs" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE POLICY "audit_logs_select_admin" ON "audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()));