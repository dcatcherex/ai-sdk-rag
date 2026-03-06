import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

// Load .env.local
const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  process.env[key] = val;
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS user_model_preference (
    user_id text PRIMARY KEY NOT NULL,
    enabled_model_ids text[] NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
  )
`;

try {
  await sql`
    ALTER TABLE user_model_preference
    ADD CONSTRAINT user_model_preference_user_id_fk
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
  `;
} catch {
  // constraint already exists
}

console.log('Migration complete: user_model_preference table created');
