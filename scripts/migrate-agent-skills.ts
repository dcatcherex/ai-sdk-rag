/**
 * Add agent_skill table and skill_ids column to agent table.
 * Run once: pnpm tsx scripts/migrate-agent-skills.ts
 */
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE agent
    ADD COLUMN IF NOT EXISTS skill_ids text[] NOT NULL DEFAULT '{}'::text[]
  `;
  console.log('✓ skill_ids column added to agent table');

  await sql`
    CREATE TABLE IF NOT EXISTS agent_skill (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text,
      trigger_type text NOT NULL DEFAULT 'keyword',
      trigger text,
      prompt_fragment text NOT NULL,
      enabled_tools text[] NOT NULL DEFAULT '{}'::text[],
      source_url text,
      is_public boolean NOT NULL DEFAULT false,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `;
  console.log('✓ agent_skill table created');

  await sql`
    CREATE INDEX IF NOT EXISTS agent_skill_userId_idx ON agent_skill (user_id)
  `;
  console.log('✓ index created');
}

main().catch((err) => { console.error(err); process.exit(1); });
