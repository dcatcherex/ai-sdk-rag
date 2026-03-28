ALTER TABLE "public_agent_share" ADD COLUMN "password_hash" text;
--> statement-breakpoint
ALTER TABLE "public_agent_share" ADD COLUMN "expires_at" timestamp;
