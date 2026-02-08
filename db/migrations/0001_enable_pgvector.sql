-- Enable pgvector extension in Neon
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table with vector embeddings
CREATE TABLE IF NOT EXISTS "document" (
  "id" text PRIMARY KEY,
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "embedding" vector(1024), -- voyage/voyage-3-large (optimized for RAG)
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create index for fast vector similarity search
CREATE INDEX IF NOT EXISTS document_embedding_idx ON "document"
USING hnsw (embedding vector_cosine_ops);

-- Create index for metadata filtering
CREATE INDEX IF NOT EXISTS document_metadata_idx ON "document" USING gin(metadata);

-- Create document chunks table (for larger documents split into chunks)
CREATE TABLE IF NOT EXISTS "document_chunk" (
  "id" text PRIMARY KEY,
  "document_id" text NOT NULL,
  "content" text NOT NULL,
  "chunk_index" integer NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "embedding" vector(1024), -- voyage/voyage-3-large (optimized for RAG)
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create index for chunk vector search
CREATE INDEX IF NOT EXISTS document_chunk_embedding_idx ON "document_chunk"
USING hnsw (embedding vector_cosine_ops);

-- Create index for document_id lookups
CREATE INDEX IF NOT EXISTS document_chunk_document_id_idx ON "document_chunk"(document_id);
