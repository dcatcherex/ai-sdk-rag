/**
 * Add brand_id column to the agent table.
 * Run once: pnpm tsx scripts/migrate-agent-brand.ts
 */
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE agent
    ADD COLUMN IF NOT EXISTS brand_id text REFERENCES brand(id) ON DELETE SET NULL
  `;
  console.log('✓ brand_id column added to agent table');
}

main().catch((err) => { console.error(err); process.exit(1); });
