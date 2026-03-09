CREATE TABLE "certificate_job" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"format" text DEFAULT 'png' NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"zip_key" text,
	"zip_url" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "certificate_template" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"r2_key" text NOT NULL,
	"url" text NOT NULL,
	"thumbnail_key" text,
	"thumbnail_url" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "approved" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "certificate_job" ADD CONSTRAINT "certificate_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_job" ADD CONSTRAINT "certificate_job_template_id_certificate_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."certificate_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_template" ADD CONSTRAINT "certificate_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certificate_job_userId_idx" ON "certificate_job" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "certificate_template_userId_idx" ON "certificate_template" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_user_id_idx" ON "document" USING btree ("user_id");