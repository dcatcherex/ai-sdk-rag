/**
 * Migration: brand strategy layer
 * Adds positioning/messaging columns to brand table + creates brand_icp table.
 * Run with: pnpm tsx scripts/migrate-brand-strategy.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql.unsafe(`
    -- Strategy columns on brand table
    ALTER TABLE "brand"
      ADD COLUMN IF NOT EXISTS "positioning_statement" text,
      ADD COLUMN IF NOT EXISTS "messaging_pillars"  text[] DEFAULT '{}'::text[] NOT NULL,
      ADD COLUMN IF NOT EXISTS "proof_points"       text[] DEFAULT '{}'::text[] NOT NULL,
      ADD COLUMN IF NOT EXISTS "example_headlines"  text[] DEFAULT '{}'::text[] NOT NULL,
      ADD COLUMN IF NOT EXISTS "example_rejections" text[] DEFAULT '{}'::text[] NOT NULL;

    -- ICP personas table
    CREATE TABLE IF NOT EXISTS "brand_icp" (
      "id"               text PRIMARY KEY NOT NULL,
      "brand_id"         text NOT NULL REFERENCES "brand"("id") ON DELETE CASCADE,
      "name"             text NOT NULL,
      "age_range"        text,
      "job_titles"       text[] DEFAULT '{}'::text[] NOT NULL,
      "pain_points"      text[] DEFAULT '{}'::text[] NOT NULL,
      "buying_triggers"  text[] DEFAULT '{}'::text[] NOT NULL,
      "objections"       text[] DEFAULT '{}'::text[] NOT NULL,
      "channels"         text[] DEFAULT '{}'::text[] NOT NULL,
      "notes"            text,
      "sort_order"       integer DEFAULT 0 NOT NULL,
      "created_at"       timestamp DEFAULT now() NOT NULL,
      "updated_at"       timestamp DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "brand_icp_brandId_idx" ON "brand_icp" ("brand_id");
  `);

  console.log('✓ brand strategy columns and brand_icp table created');
  await sql.end();
}

void main();
