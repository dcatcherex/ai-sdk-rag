ALTER TABLE "public_agent_share" ADD COLUMN "max_uses" integer;
--> statement-breakpoint
ALTER TABLE "public_agent_share" ADD COLUMN "credit_limit" integer;
--> statement-breakpoint
ALTER TABLE "public_agent_share" ADD COLUMN "credits_used" integer DEFAULT 0 NOT NULL;
