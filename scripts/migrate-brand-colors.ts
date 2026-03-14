/**
 * Migrates brand table: replaces colorPrimary/Secondary/Accent columns
 * with a flexible `colors` JSONB array.
 * Run with: pnpm tsx scripts/migrate-brand-colors.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  // 1. Add new column
  await sql.unsafe(`
    ALTER TABLE brand
      ADD COLUMN IF NOT EXISTS colors jsonb DEFAULT '[]'::jsonb NOT NULL;
  `);

  // 2. Migrate existing data — preserve order: Primary, Secondary, Accent
  await sql.unsafe(`
    UPDATE brand
    SET colors = (
      SELECT COALESCE(jsonb_agg(c ORDER BY ord), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object('hex', color_primary,   'label', 'Primary')   AS c, 1 AS ord WHERE color_primary   IS NOT NULL
        UNION ALL
        SELECT jsonb_build_object('hex', color_secondary, 'label', 'Secondary') AS c, 2 AS ord WHERE color_secondary IS NOT NULL
        UNION ALL
        SELECT jsonb_build_object('hex', color_accent,    'label', 'Accent')    AS c, 3 AS ord WHERE color_accent    IS NOT NULL
      ) t
    )
    WHERE color_primary IS NOT NULL
       OR color_secondary IS NOT NULL
       OR color_accent IS NOT NULL;
  `);

  // 3. Drop old columns
  await sql.unsafe(`
    ALTER TABLE brand
      DROP COLUMN IF EXISTS color_primary,
      DROP COLUMN IF EXISTS color_secondary,
      DROP COLUMN IF EXISTS color_accent;
  `);

  console.log('✓ brand.colors migrated — old color columns dropped');
  await sql.end();
}

void main();
