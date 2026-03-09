import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS enabled_tool_ids text[]
`;

console.log('Migration complete: enabled_tool_ids column added to user_preferences');
