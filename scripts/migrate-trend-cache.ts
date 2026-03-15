/**
 * Runs the trend_cache table migration directly via Neon client.
 * Usage: pnpm tsx scripts/migrate-trend-cache.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  console.log('Creating trend_cache table...');

  await sql`
    CREATE TABLE IF NOT EXISTS "trend_cache" (
      "id"         text PRIMARY KEY,
      "platform"   text NOT NULL,
      "industry"   text NOT NULL DEFAULT 'all',
      "items"      jsonb NOT NULL DEFAULT '[]'::jsonb,
      "week_key"   text NOT NULL,
      "fetched_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "trend_cache_platform_industry_idx"
      ON "trend_cache" ("platform", "industry")
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "trend_cache_week_platform_industry_idx"
      ON "trend_cache" ("week_key", "platform", "industry")
  `;

  console.log('trend_cache table created (or already exists).');
}

run().catch(console.error);
