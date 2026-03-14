CREATE TABLE "agent_share" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"shared_with_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"overview" text,
	"website_url" text,
	"industry" text,
	"target_audience" text,
	"tone_of_voice" text[] DEFAULT '{}'::text[] NOT NULL,
	"brand_values" text[] DEFAULT '{}'::text[] NOT NULL,
	"visual_aesthetics" text[] DEFAULT '{}'::text[] NOT NULL,
	"fonts" text[] DEFAULT '{}'::text[] NOT NULL,
	"color_primary" text,
	"color_secondary" text,
	"color_accent" text,
	"writing_dos" text,
	"writing_donts" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"kind" text NOT NULL,
	"collection" text,
	"title" text NOT NULL,
	"r2_key" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"tool_run_id" text NOT NULL,
	"kind" text NOT NULL,
	"format" text NOT NULL,
	"storage_url" text,
	"payload_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_run" (
	"id" text PRIMARY KEY NOT NULL,
	"tool_slug" text NOT NULL,
	"user_id" text NOT NULL,
	"thread_id" text,
	"source" text NOT NULL,
	"input_json" jsonb NOT NULL,
	"output_json" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "export_mode" text DEFAULT 'zip' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "download_label" text;--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "result_key" text;--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "result_url" text;--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "request_payload" jsonb;--> statement-breakpoint
ALTER TABLE "certificate_job" ADD COLUMN "result_payload" jsonb;--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "template_type" text DEFAULT 'certificate' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_r2_key" text;--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_url" text;--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_thumbnail_key" text;--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_width" integer;--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_height" integer;--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "back_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "certificate_template" ADD COLUMN "print_settings" jsonb DEFAULT '{"preset":"a4_3x3","pageSize":"A4","columns":3,"rows":3,"marginTopMm":12,"marginRightMm":12,"marginBottomMm":12,"marginLeftMm":12,"gapXMm":4,"gapYMm":4,"cropMarks":false,"cropMarkLengthMm":4,"cropMarkOffsetMm":2,"duplexMode":"single_sided","backPageOrder":"same","backOffsetXMm":0,"backOffsetYMm":0,"backFlipX":false,"backFlipY":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "original_content" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "processing_status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "analysis_result" jsonb;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "storage_mode" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "processing_mode" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "r2_key" text;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "rerank_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_share" ADD CONSTRAINT "agent_share_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_share" ADD CONSTRAINT "agent_share_shared_with_user_id_user_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand" ADD CONSTRAINT "brand_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_asset" ADD CONSTRAINT "brand_asset_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_artifact" ADD CONSTRAINT "tool_artifact_tool_run_id_tool_run_id_fk" FOREIGN KEY ("tool_run_id") REFERENCES "public"."tool_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_run" ADD CONSTRAINT "tool_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_run" ADD CONSTRAINT "tool_run_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_share_unique_idx" ON "agent_share" USING btree ("agent_id","shared_with_user_id");--> statement-breakpoint
CREATE INDEX "agent_share_agentId_idx" ON "agent_share" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_share_sharedWithUserId_idx" ON "agent_share" USING btree ("shared_with_user_id");--> statement-breakpoint
CREATE INDEX "brand_userId_idx" ON "brand" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "brand_asset_brandId_idx" ON "brand_asset" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "brand_asset_kind_idx" ON "brand_asset" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "tool_artifact_runId_idx" ON "tool_artifact" USING btree ("tool_run_id");--> statement-breakpoint
CREATE INDEX "tool_run_userId_idx" ON "tool_run" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tool_run_toolSlug_idx" ON "tool_run" USING btree ("tool_slug");--> statement-breakpoint
CREATE INDEX "tool_run_threadId_idx" ON "tool_run" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "document_fts_idx" ON "document" USING gin (to_tsvector('english', "content"));--> statement-breakpoint
CREATE INDEX "document_chunk_fts_idx" ON "document_chunk" USING gin (to_tsvector('english', "content"));