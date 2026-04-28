CREATE TABLE "line_flex_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text,
	"name" text NOT NULL,
	"alt_text" text NOT NULL,
	"flex_payload" jsonb NOT NULL,
	"template_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_flex_template" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"tags" text[] DEFAULT '{}',
	"flex_payload" jsonb NOT NULL,
	"alt_text" text NOT NULL,
	"preview_image_url" text,
	"catalog_status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "line_flex_draft" ADD CONSTRAINT "line_flex_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_flex_draft" ADD CONSTRAINT "line_flex_draft_channel_id_line_oa_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."line_oa_channel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_flex_draft" ADD CONSTRAINT "line_flex_draft_template_id_line_flex_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."line_flex_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "line_flex_draft_user_idx" ON "line_flex_draft" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "line_flex_draft_channel_idx" ON "line_flex_draft" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "line_flex_template_status_idx" ON "line_flex_template" USING btree ("catalog_status");--> statement-breakpoint
CREATE INDEX "line_flex_template_category_idx" ON "line_flex_template" USING btree ("category");