/**
 * Create brand_share table for brand team sharing.
 * Run once: pnpm tsx scripts/migrate-brand-share.ts
 */
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS brand_share (
      id          text PRIMARY KEY,
      brand_id    text NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
      shared_with_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      created_at  timestamp NOT NULL DEFAULT now(),
      CONSTRAINT brand_share_unique_idx UNIQUE (brand_id, shared_with_user_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS brand_share_brand_id_idx ON brand_share (brand_id)`;
  await sql`CREATE INDEX IF NOT EXISTS brand_share_user_id_idx ON brand_share (shared_with_user_id)`;
  console.log('✓ brand_share table created');
}

main().catch((err) => { console.error(err); process.exit(1); });
