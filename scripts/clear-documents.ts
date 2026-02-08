#!/usr/bin/env tsx
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('🗑️  Clearing all documents...\n');

  // Delete all document chunks
  const chunksDeleted = await db.execute(sql`DELETE FROM document_chunk`);
  console.log(`Deleted ${chunksDeleted.rowCount || 0} document chunks`);

  // Delete all documents
  const docsDeleted = await db.execute(sql`DELETE FROM document`);
  console.log(`Deleted ${docsDeleted.rowCount || 0} documents`);

  console.log('\n✅ All documents cleared!');
  console.log('   Run test-rag.ts again to re-ingest with current embedding model');
}

main().catch(console.error);
