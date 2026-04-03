import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "campaign_brief" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "brand_id" text REFERENCES "brand"("id") ON DELETE SET NULL,
      "title" text NOT NULL,
      "goal" text,
      "offer" text,
      "key_message" text,
      "cta" text,
      "channels" text[] NOT NULL DEFAULT '{}'::text[],
      "start_date" text,
      "end_date" text,
      "status" text NOT NULL DEFAULT 'draft',
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "campaign_brief_userId_idx" ON "campaign_brief" ("user_id");
    CREATE INDEX IF NOT EXISTS "campaign_brief_brandId_idx" ON "campaign_brief" ("brand_id");
    CREATE INDEX IF NOT EXISTS "campaign_brief_status_idx" ON "campaign_brief" ("status");

    CREATE TABLE IF NOT EXISTS "content_calendar_entry" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "brand_id" text REFERENCES "brand"("id") ON DELETE SET NULL,
      "campaign_id" text REFERENCES "campaign_brief"("id") ON DELETE SET NULL,
      "content_piece_id" text REFERENCES "content_piece"("id") ON DELETE SET NULL,
      "title" text NOT NULL,
      "content_type" text NOT NULL,
      "channel" text,
      "status" text NOT NULL DEFAULT 'idea',
      "planned_date" text NOT NULL,
      "notes" text,
      "color" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "calendar_entry_userId_idx" ON "content_calendar_entry" ("user_id");
    CREATE INDEX IF NOT EXISTS "calendar_entry_brandId_idx" ON "content_calendar_entry" ("brand_id");
    CREATE INDEX IF NOT EXISTS "calendar_entry_campaignId_idx" ON "content_calendar_entry" ("campaign_id");
    CREATE INDEX IF NOT EXISTS "calendar_entry_plannedDate_idx" ON "content_calendar_entry" ("planned_date");
    CREATE INDEX IF NOT EXISTS "calendar_entry_status_idx" ON "content_calendar_entry" ("status");
  `);

  console.log('✓ planning tables created');
  await sql.end();
}

void main();
