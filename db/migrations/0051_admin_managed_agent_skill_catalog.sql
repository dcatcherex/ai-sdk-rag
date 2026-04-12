ALTER TABLE "agent" ADD COLUMN "catalog_scope" text DEFAULT 'personal' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "catalog_status" text DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "managed_by_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "clone_behavior" text DEFAULT 'editable_copy' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "update_policy" text DEFAULT 'notify' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "locked_fields" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "source_template_version" integer;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "published_at" timestamp;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "archived_at" timestamp;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "changelog" text;
--> statement-breakpoint

ALTER TABLE "agent_skill" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "template_id" text;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "catalog_scope" text DEFAULT 'personal' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "catalog_status" text DEFAULT 'draft' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "managed_by_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "clone_behavior" text DEFAULT 'editable_copy' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "update_policy" text DEFAULT 'notify' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "locked_fields" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "source_template_version" integer;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "published_at" timestamp;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "archived_at" timestamp;
--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "changelog" text;
--> statement-breakpoint

UPDATE "agent"
SET
  "catalog_scope" = CASE WHEN "is_template" = true AND "user_id" IS NULL THEN 'system' ELSE 'personal' END,
  "catalog_status" = CASE WHEN "is_template" = true AND "user_id" IS NULL THEN 'published' ELSE 'draft' END,
  "managed_by_admin" = CASE WHEN "is_template" = true AND "user_id" IS NULL THEN true ELSE false END,
  "published_at" = CASE WHEN "is_template" = true AND "user_id" IS NULL THEN "updated_at" ELSE NULL END;
