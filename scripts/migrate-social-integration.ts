/**
 * Migration: Social post integration with end-to-end content marketing flow
 *
 * Adds to social_post:
 *   - campaign_id  → links post to a campaign_brief
 *   - calendar_entry_id → links to content_calendar_entry created on schedule
 *   - content_piece_id  → links to content_piece created on publish
 *
 * Run with:
 *   npx tsx scripts/migrate-social-integration.ts
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

async function main() {
  console.log('Running social integration migration…');

  await sql.unsafe(`
    ALTER TABLE social_post
      ADD COLUMN IF NOT EXISTS campaign_id        TEXT REFERENCES campaign_brief(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS calendar_entry_id  TEXT,
      ADD COLUMN IF NOT EXISTS content_piece_id   TEXT;

    CREATE INDEX IF NOT EXISTS social_post_campaignId_idx ON social_post(campaign_id);
  `);
  console.log('✓ social_post columns added');

  console.log('Social integration migration complete.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
