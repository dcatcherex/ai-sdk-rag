#!/usr/bin/env tsx
/**
 * Debug Vector Storage
 *
 * Check if embeddings are being stored correctly
 */

import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('🔍 Debugging Vector Storage\n');

  // Check document count
  const docs = await db.execute(sql`
    SELECT COUNT(*) as count FROM document
  `);
  console.log(`Documents: ${(docs.rows[0] as any).count}`);

  // Check document_chunk count
  const chunks = await db.execute(sql`
    SELECT COUNT(*) as count FROM document_chunk
  `);
  console.log(`Document chunks: ${(chunks.rows[0] as any).count}\n`);

  // Check if embeddings are present in document table
  const docsWithEmbedding = await db.execute(sql`
    SELECT
      id,
      content,
      embedding IS NOT NULL as has_embedding
    FROM document
    LIMIT 3
  `);

  console.log('Sample documents:');
  docsWithEmbedding.rows.forEach((row: any, i) => {
    console.log(`\n${i + 1}. ID: ${row.id}`);
    console.log(`   Content: ${row.content.substring(0, 60)}...`);
    console.log(`   Has embedding: ${row.has_embedding}`);
  });

  // Try a simple similarity search with a dummy vector
  console.log('\n\n🔍 Testing vector search syntax...\n');

  try {
    // Create a dummy 1024-dimensional vector (all zeros)
    const dummyVector = new Array(1024).fill(0);
    const vectorStr = `[${dummyVector.join(',')}]`;

    const testQuery = await db.execute(sql`
      SELECT
        id,
        content,
        embedding <=> ${vectorStr}::vector as distance
      FROM document
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT 1
    `);

    if (testQuery.rows.length > 0) {
      console.log('✅ Vector search syntax works!');
      console.log(`   Found document: ${(testQuery.rows[0] as any).id}`);
    } else {
      console.log('⚠️  No documents with embeddings found');
    }
  } catch (error: any) {
    console.error('❌ Vector search failed:', error.message);
  }
}

main().catch(console.error);
