/**
 * Migration: Phase 4 Analytics & Distribution tables
 *
 * Creates:
 *   - content_piece_metric
 *   - ab_variant
 *   - distribution_record
 *
 * Run with:
 *   npx tsx scripts/migrate-analytics.ts
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

async function main() {
  console.log('Running Phase 4 analytics migration…');

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS content_piece_metric (
      id                TEXT PRIMARY KEY,
      content_piece_id  TEXT NOT NULL REFERENCES content_piece(id) ON DELETE CASCADE,
      user_id           TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      platform          TEXT NOT NULL,
      views             INTEGER NOT NULL DEFAULT 0,
      clicks            INTEGER NOT NULL DEFAULT 0,
      impressions       INTEGER NOT NULL DEFAULT 0,
      engagement        INTEGER NOT NULL DEFAULT 0,
      conversions       INTEGER NOT NULL DEFAULT 0,
      ctr               REAL,
      notes             TEXT,
      measured_at       TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at        TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS metric_contentPieceId_idx ON content_piece_metric(content_piece_id);
    CREATE INDEX IF NOT EXISTS metric_userId_idx ON content_piece_metric(user_id);
    CREATE INDEX IF NOT EXISTS metric_platform_idx ON content_piece_metric(platform);
    CREATE INDEX IF NOT EXISTS metric_measuredAt_idx ON content_piece_metric(measured_at);
  `);
  console.log('✓ content_piece_metric');

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ab_variant (
      id                TEXT PRIMARY KEY,
      content_piece_id  TEXT NOT NULL REFERENCES content_piece(id) ON DELETE CASCADE,
      user_id           TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      variant_label     TEXT NOT NULL,
      body              TEXT NOT NULL,
      impressions       INTEGER NOT NULL DEFAULT 0,
      clicks            INTEGER NOT NULL DEFAULT 0,
      conversions       INTEGER NOT NULL DEFAULT 0,
      is_winner         BOOLEAN NOT NULL DEFAULT FALSE,
      created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS ab_variant_contentPieceId_idx ON ab_variant(content_piece_id);
    CREATE INDEX IF NOT EXISTS ab_variant_userId_idx ON ab_variant(user_id);
  `);
  console.log('✓ ab_variant');

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS distribution_record (
      id                TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      content_piece_id  TEXT REFERENCES content_piece(id) ON DELETE SET NULL,
      brand_id          TEXT REFERENCES brand(id) ON DELETE SET NULL,
      channel           TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'pending',
      recipient_count   INTEGER,
      external_ref      TEXT,
      scheduled_at      TIMESTAMP,
      sent_at           TIMESTAMP,
      error_message     TEXT,
      metadata          JSONB NOT NULL DEFAULT '{}',
      created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS distribution_userId_idx ON distribution_record(user_id);
    CREATE INDEX IF NOT EXISTS distribution_contentPieceId_idx ON distribution_record(content_piece_id);
    CREATE INDEX IF NOT EXISTS distribution_channel_idx ON distribution_record(channel);
    CREATE INDEX IF NOT EXISTS distribution_status_idx ON distribution_record(status);
  `);
  console.log('✓ distribution_record');

  console.log('Phase 4 migration complete.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
