-- Guest access feature: platform_settings + guest_session + chatThread changes

-- Platform settings singleton (id always = 1)
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "guest_access_enabled" boolean NOT NULL DEFAULT false,
  "guest_starting_credits" integer NOT NULL DEFAULT 20,
  "guest_session_ttl_days" integer NOT NULL DEFAULT 7,
  "signup_bonus_credits" integer NOT NULL DEFAULT 100,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Guest sessions (anonymous users)
CREATE TABLE IF NOT EXISTS "guest_session" (
  "id" text PRIMARY KEY,
  "ip_hash" text NOT NULL,
  "credits" integer NOT NULL DEFAULT 0,
  "total_granted" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "guest_session_ip_hash_idx" ON "guest_session" ("ip_hash");
CREATE INDEX IF NOT EXISTS "guest_session_expires_at_idx" ON "guest_session" ("expires_at");

-- Make chatThread.userId nullable (guests have no userId)
ALTER TABLE "chat_thread" ALTER COLUMN "user_id" DROP NOT NULL;

-- Add guestSessionId to chatThread
ALTER TABLE "chat_thread" ADD COLUMN IF NOT EXISTS "guest_session_id" text
  REFERENCES "guest_session"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "chat_thread_guestSessionId_idx" ON "chat_thread" ("guest_session_id");

-- Seed default platform_settings row
INSERT INTO "platform_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;