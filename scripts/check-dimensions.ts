#!/usr/bin/env tsx
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  // Check vector dimensions in the database
  const result = await db.execute(sql`
    SELECT
      column_name,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_name IN ('document', 'document_chunk')
      AND column_name = 'embedding'
  `);

  console.log('Vector column info:');
  result.rows.forEach((row: any) => {
    console.log(row);
  });
}

main().catch(console.error);
