-- Make thread_id and message_id nullable on media_asset
-- so tool-page generated images (no chat thread) can be stored.

ALTER TABLE "media_asset" DROP CONSTRAINT IF EXISTS "media_asset_thread_id_chat_thread_id_fk";--> statement-breakpoint
ALTER TABLE "media_asset" DROP CONSTRAINT IF EXISTS "media_asset_message_id_chat_message_id_fk";--> statement-breakpoint
ALTER TABLE "media_asset" ALTER COLUMN "thread_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media_asset" ALTER COLUMN "message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE set null ON UPDATE no action;
