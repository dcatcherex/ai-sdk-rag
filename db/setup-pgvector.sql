-- Run this SQL in your Neon console AFTER running drizzle-kit push
-- This creates the HNSW indexes for fast vector similarity search

-- Create HNSW index for document table
CREATE INDEX IF NOT EXISTS document_embedding_idx ON "document"
USING hnsw (embedding vector_cosine_ops);

-- Create HNSW index for document_chunk table
CREATE INDEX IF NOT EXISTS document_chunk_embedding_idx ON "document_chunk"
USING hnsw (embedding vector_cosine_ops);

-- Verify indexes were created
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('document', 'document_chunk')
  AND indexname LIKE '%embedding%';
