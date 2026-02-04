-- Migration: Add message reactions
-- Created: 2026-02-04

ALTER TABLE "chat_message"
ADD COLUMN IF NOT EXISTS "reaction" text;

-- reaction values: 'thumbs_up', 'thumbs_down', or NULL
