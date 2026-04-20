ALTER TABLE "chat_thread" ADD COLUMN "agent_id" text;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD COLUMN "guest_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_thread_share_guest_idx" ON "chat_thread" USING btree ("share_token","guest_id") WHERE share_token IS NOT NULL AND guest_id IS NOT NULL;