-- Migration: Add token usage tracking
-- Created: 2026-02-04

CREATE TABLE IF NOT EXISTS "token_usage" (
  "id" text PRIMARY KEY NOT NULL,
  "thread_id" text NOT NULL REFERENCES "chat_thread"("id") ON DELETE CASCADE,
  "model" text NOT NULL,
  "prompt_tokens" integer NOT NULL,
  "completion_tokens" integer NOT NULL,
  "total_tokens" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "token_usage_thread_idx" ON "token_usage" ("thread_id");
