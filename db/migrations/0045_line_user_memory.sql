-- Make userId nullable to support unlinked LINE users
ALTER TABLE "user_memory" ALTER COLUMN "user_id" DROP NOT NULL;

-- Add lineUserId column for unlinked LINE users
ALTER TABLE "user_memory" ADD COLUMN "line_user_id" text;

-- Index for fast lookups by LINE user ID
CREATE INDEX "user_memory_lineUserId_idx" ON "user_memory" ("line_user_id");

-- Ensure every row has at least one owner
ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_owner_check"
  CHECK (user_id IS NOT NULL OR line_user_id IS NOT NULL);
