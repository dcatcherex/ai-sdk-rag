ALTER TABLE "brand_photo" ADD COLUMN "brand_id" text;--> statement-breakpoint
CREATE INDEX "brand_photo_brandId_idx" ON "brand_photo" ("brand_id");
