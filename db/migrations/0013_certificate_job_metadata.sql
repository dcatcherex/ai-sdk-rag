ALTER TABLE "certificate_job" ADD COLUMN "export_mode" text DEFAULT 'zip' NOT NULL;
--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "file_name" text;
--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "download_label" text;
--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "result_key" text;
--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "result_url" text;
--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "request_payload" jsonb;
--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "result_payload" jsonb;
--> statement-breakpoint
UPDATE "certificate_job"
SET
  "result_key" = COALESCE("result_key", "zip_key"),
  "result_url" = COALESCE("result_url", "zip_url")
WHERE "zip_key" IS NOT NULL OR "zip_url" IS NOT NULL;
