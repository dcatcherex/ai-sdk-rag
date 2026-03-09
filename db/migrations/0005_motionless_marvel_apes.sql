ALTER TABLE "user_preferences" ADD COLUMN "follow_up_suggestions_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "enabled_tool_ids" text[];