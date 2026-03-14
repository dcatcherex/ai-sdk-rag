/**
 * One-time migration script: creates brand + brand_asset tables.
 * Run with: pnpm tsx scripts/migrate-brands.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

async function main() {
const sql = postgres(process.env.DATABASE_URL!);

await sql.unsafe(`
CREATE TABLE IF NOT EXISTS "brand" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "overview" text,
  "website_url" text,
  "industry" text,
  "target_audience" text,
  "tone_of_voice" text[] DEFAULT '{}'::text[] NOT NULL,
  "brand_values" text[] DEFAULT '{}'::text[] NOT NULL,
  "visual_aesthetics" text[] DEFAULT '{}'::text[] NOT NULL,
  "fonts" text[] DEFAULT '{}'::text[] NOT NULL,
  "color_primary" text,
  "color_secondary" text,
  "color_accent" text,
  "writing_dos" text,
  "writing_donts" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "brand_asset" (
  "id" text PRIMARY KEY NOT NULL,
  "brand_id" text NOT NULL REFERENCES "brand"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "collection" text,
  "title" text NOT NULL,
  "r2_key" text NOT NULL,
  "url" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "brand_userId_idx" ON "brand" ("user_id");
CREATE INDEX IF NOT EXISTS "brand_asset_brandId_idx" ON "brand_asset" ("brand_id");
CREATE INDEX IF NOT EXISTS "brand_asset_kind_idx" ON "brand_asset" ("kind");
`);

console.log('✓ brand and brand_asset tables created');
await sql.end();
}

void main();
