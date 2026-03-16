CREATE TABLE IF NOT EXISTS "website" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"template_slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"site_data_json" jsonb,
	"rendered_html_key" text,
	"rendered_html_url" text,
	"pages_project_name" text,
	"pages_deployment_id" text,
	"live_url" text,
	"custom_domain" text,
	"error" text,
	"generation_count" integer DEFAULT 0 NOT NULL,
	"edit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "website_template" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"thumbnail_url" text,
	"category" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"default_site_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "website_template_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "website_generation_log" (
	"id" text PRIMARY KEY NOT NULL,
	"website_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"prompt_text" text NOT NULL,
	"model_id" text NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"credits_deducted" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "website" ADD CONSTRAINT "website_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "website_generation_log" ADD CONSTRAINT "website_generation_log_website_id_website_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."website"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "website_generation_log" ADD CONSTRAINT "website_generation_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "website_userId_idx" ON "website" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "website_userId_slug_idx" ON "website" USING btree ("user_id","slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "website_gen_log_websiteId_idx" ON "website_generation_log" USING btree ("website_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "website_gen_log_userId_idx" ON "website_generation_log" USING btree ("user_id");
