import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

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
  CREATE TABLE IF NOT EXISTS certificate_template (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    r2_key text NOT NULL,
    url text NOT NULL,
    thumbnail_key text,
    thumbnail_url text,
    width integer NOT NULL,
    height integer NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
  )
`;
console.log('certificate_template created');

await sql`
  CREATE TABLE IF NOT EXISTS certificate_job (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    template_id text NOT NULL REFERENCES certificate_template(id) ON DELETE CASCADE,
    status text DEFAULT 'pending' NOT NULL,
    format text DEFAULT 'png' NOT NULL,
    total_count integer DEFAULT 0 NOT NULL,
    processed_count integer DEFAULT 0 NOT NULL,
    zip_key text,
    zip_url text,
    error text,
    created_at timestamp DEFAULT now() NOT NULL,
    completed_at timestamp
  )
`;
console.log('certificate_job created');

try {
  await sql`CREATE INDEX certificate_template_userId_idx ON certificate_template (user_id)`;
  await sql`CREATE INDEX certificate_job_userId_idx ON certificate_job (user_id)`;
} catch { /* indexes may already exist */ }

console.log('Migration complete: certificate tables ready');
