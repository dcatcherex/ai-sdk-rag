CREATE TABLE "rich_message_template" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"intent" text NOT NULL,
	"schema_json" jsonb NOT NULL,
	"layout_json" jsonb NOT NULL,
	"fallback_json" jsonb,
	"sample_data_json" jsonb NOT NULL,
	"supported_channels" text[] NOT NULL,
	"catalog_status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rich_message_template_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE INDEX "rich_message_template_key_idx" ON "rich_message_template" USING btree ("key");--> statement-breakpoint
CREATE INDEX "rich_message_template_status_idx" ON "rich_message_template" USING btree ("catalog_status");--> statement-breakpoint
CREATE INDEX "rich_message_template_category_idx" ON "rich_message_template" USING btree ("category");
