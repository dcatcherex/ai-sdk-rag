ALTER TABLE "certificate_template" ADD COLUMN "back_r2_key" text;
--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_url" text;
--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_thumbnail_key" text;
--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_thumbnail_url" text;
--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_width" integer;
--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_height" integer;
--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;
