-- User Preferences (memory toggle, prompt enhancement toggle)
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "memory_enabled" boolean NOT NULL DEFAULT true,
  "prompt_enhancement_enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- User Memory Facts
CREATE TABLE IF NOT EXISTS "user_memory" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "fact" text NOT NULL,
  "source_thread_id" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_memory_userId_idx" ON "user_memory" ("user_id");
