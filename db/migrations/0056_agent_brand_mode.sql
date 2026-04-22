ALTER TABLE "agent" ADD COLUMN "brand_mode" text DEFAULT 'optional' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "brand_access_policy" text DEFAULT 'any_accessible' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "requires_brand_for_run" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "fallback_behavior" text DEFAULT 'ask_or_continue' NOT NULL;
