import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS content_piece (
      id                       text PRIMARY KEY,
      user_id                  text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      brand_id                 text REFERENCES brand(id) ON DELETE SET NULL,
      content_type             text NOT NULL,
      title                    text NOT NULL,
      body                     text,
      excerpt                  text,
      status                   text NOT NULL DEFAULT 'draft',
      channel                  text,
      metadata                 jsonb NOT NULL DEFAULT '{}',
      parent_id                text REFERENCES content_piece(id) ON DELETE SET NULL,
      generated_by_team_run_id text,
      created_at               timestamp NOT NULL DEFAULT now(),
      updated_at               timestamp NOT NULL DEFAULT now()
    );
  `);

  await sql.unsafe(`CREATE INDEX IF NOT EXISTS content_piece_userId_idx  ON content_piece (user_id);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS content_piece_brandId_idx ON content_piece (brand_id);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS content_piece_status_idx  ON content_piece (status);`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS content_piece_parentId_idx ON content_piece (parent_id);`);

  console.log('✓ content_piece table and indexes created');
  await sql.end();
}

void main();
