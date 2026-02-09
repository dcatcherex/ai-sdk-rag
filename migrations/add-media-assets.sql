-- Migration: Add media assets table
-- Created: 2026-02-08

CREATE TABLE IF NOT EXISTS "media_asset" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "thread_id" text NOT NULL REFERENCES "chat_thread"("id") ON DELETE CASCADE,
  "message_id" text NOT NULL REFERENCES "chat_message"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "r2_key" text NOT NULL,
  "url" text NOT NULL,
  "thumbnail_key" text,
  "thumbnail_url" text,
  "mime_type" text NOT NULL,
  "width" integer,
  "height" integer,
  "duration_ms" integer,
  "size_bytes" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "media_asset_thread_idx" ON "media_asset" ("thread_id");
CREATE INDEX IF NOT EXISTS "media_asset_message_idx" ON "media_asset" ("message_id");
CREATE INDEX IF NOT EXISTS "media_asset_user_idx" ON "media_asset" ("user_id");
CREATE INDEX IF NOT EXISTS "media_asset_type_idx" ON "media_asset" ("type");
