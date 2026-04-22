ALTER TABLE "brand"
  ADD COLUMN "products_services" text,
  ADD COLUMN "voice_examples" text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN "forbidden_phrases" text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN "color_notes" text,
  ADD COLUMN "style_reference_mode" text DEFAULT 'direct' NOT NULL,
  ADD COLUMN "style_description" text,
  ADD COLUMN "usp" text,
  ADD COLUMN "price_range" text,
  ADD COLUMN "keywords" text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN "platforms" text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN "promotion_style" text,
  ADD COLUMN "competitors" text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN "customer_pain_points" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint

CREATE TABLE "line_brand_draft" (
  "id" text PRIMARY KEY NOT NULL,
  "line_user_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "field" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "line_brand_draft_lineUserId_channelId_idx"
  ON "line_brand_draft" USING btree ("line_user_id","channel_id");
