CREATE TABLE "line_brand_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"line_user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_image" (
	"id" text PRIMARY KEY NOT NULL,
	"style_tag" text,
	"aspect_ratio" text,
	"image_url" text NOT NULL,
	"thumbnail_url" text,
	"used_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_image_image_url_unique" UNIQUE("image_url")
);
--> statement-breakpoint
ALTER TABLE "brand_profile" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "brand_profile" CASCADE;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "products_services" text;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "voice_examples" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "forbidden_phrases" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "color_notes" text;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "style_reference_mode" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "style_description" text;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "usp" text;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "price_range" text;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "keywords" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "platforms" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "promotion_style" text;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "competitors" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN "customer_pain_points" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "brand_mode" text DEFAULT 'optional' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "brand_access_policy" text DEFAULT 'any_accessible' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "requires_brand_for_run" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "fallback_behavior" text DEFAULT 'ask_or_continue' NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_photo" ADD COLUMN "brand_id" text;--> statement-breakpoint
ALTER TABLE "image_model_config" ADD COLUMN "task_defaults" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "instant_stock_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "line_brand_draft_lineUserId_channelId_idx" ON "line_brand_draft" USING btree ("line_user_id","channel_id");--> statement-breakpoint
CREATE INDEX "stock_image_styleTag_aspectRatio_idx" ON "stock_image" USING btree ("style_tag","aspect_ratio");--> statement-breakpoint
CREATE INDEX "brand_photo_brandId_idx" ON "brand_photo" USING btree ("brand_id");