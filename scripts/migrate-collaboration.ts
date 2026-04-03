/**
 * One-time migration script: creates collaboration tables.
 * Run with: pnpm tsx scripts/migrate-collaboration.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql.unsafe(`
CREATE TABLE IF NOT EXISTS "workspace_member" (
  "id" text PRIMARY KEY NOT NULL,
  "brand_id" text NOT NULL REFERENCES "brand"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'writer',
  "invited_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "joined_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_member_brandId_userId_idx" UNIQUE ("brand_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "workspace_member_brandId_idx" ON "workspace_member" ("brand_id");
CREATE INDEX IF NOT EXISTS "workspace_member_userId_idx" ON "workspace_member" ("user_id");

CREATE TABLE IF NOT EXISTS "approval_request" (
  "id" text PRIMARY KEY NOT NULL,
  "content_piece_id" text NOT NULL REFERENCES "content_piece"("id") ON DELETE CASCADE,
  "brand_id" text REFERENCES "brand"("id") ON DELETE SET NULL,
  "requester_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "assignee_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "due_at" timestamp,
  "resolved_at" timestamp,
  "resolution_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "approval_brandId_idx" ON "approval_request" ("brand_id");
CREATE INDEX IF NOT EXISTS "approval_assigneeId_idx" ON "approval_request" ("assignee_id");
CREATE INDEX IF NOT EXISTS "approval_status_idx" ON "approval_request" ("status");
CREATE INDEX IF NOT EXISTS "approval_contentPieceId_idx" ON "approval_request" ("content_piece_id");

CREATE TABLE IF NOT EXISTS "content_comment" (
  "id" text PRIMARY KEY NOT NULL,
  "content_piece_id" text NOT NULL REFERENCES "content_piece"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "parent_id" text REFERENCES "content_comment"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "resolved" boolean NOT NULL DEFAULT false,
  "resolved_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "comment_contentPieceId_idx" ON "content_comment" ("content_piece_id");
CREATE INDEX IF NOT EXISTS "comment_userId_idx" ON "content_comment" ("user_id");
CREATE INDEX IF NOT EXISTS "comment_parentId_idx" ON "content_comment" ("parent_id");

CREATE TABLE IF NOT EXISTS "brand_guardrail" (
  "id" text PRIMARY KEY NOT NULL,
  "brand_id" text NOT NULL REFERENCES "brand"("id") ON DELETE CASCADE,
  "rule_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "pattern" text,
  "severity" text NOT NULL DEFAULT 'warning',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "guardrail_brandId_idx" ON "brand_guardrail" ("brand_id");
CREATE INDEX IF NOT EXISTS "guardrail_ruleType_idx" ON "brand_guardrail" ("rule_type");
`);

  console.log('✓ collaboration tables created (workspace_member, approval_request, content_comment, brand_guardrail)');
  await sql.end();
}

void main();
