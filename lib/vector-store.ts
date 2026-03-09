/**
 * Vector Store Service
 *
 * Manages document storage and retrieval using pgvector in Neon database.
 * Provides semantic search capabilities for RAG applications.
 */

import { db } from './db';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { generateEmbedding, generateEmbeddings, chunkText } from './embeddings';

export interface Document {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: Record<string, any>;
  embedding?: number[];
  createdAt: Date;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

export interface AddDocumentOptions {
  userId?: string;
  metadata?: Record<string, any>;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface SearchOptions {
  limit?: number;
  minSimilarity?: number;
  filter?: Record<string, any>;
  userId?: string;
}

/**
 * Add a document to the vector store
 * Automatically chunks large documents and generates embeddings
 */
export async function addDocument(
  content: string,
  options: AddDocumentOptions = {}
): Promise<string> {
  const documentId = nanoid();
  const metadata = options.metadata || {};
  const userId = options.userId ?? null;

  // For shorter documents, store as single document
  if (content.length < 2000) {
    const embedding = await generateEmbedding(content);

    await db.execute(sql`
      INSERT INTO document (id, user_id, content, metadata, embedding, created_at, updated_at)
      VALUES (
        ${documentId},
        ${userId},
        ${content},
        ${JSON.stringify(metadata)}::jsonb,
        ${JSON.stringify(embedding)}::vector,
        NOW(),
        NOW()
      )
    `);

    return documentId;
  }

  // For longer documents, chunk and store separately
  const chunks = chunkText(content, {
    chunkSize: options.chunkSize || 1000,
    chunkOverlap: options.chunkOverlap || 200,
  });

  // Generate embeddings in batches to avoid API limits
  const BATCH_SIZE = 20;
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await generateEmbeddings(batch);
    embeddings.push(...batchEmbeddings);
  }

  // Store parent document (without embedding to save space)
  await db.execute(sql`
    INSERT INTO document (id, user_id, content, metadata, created_at, updated_at)
    VALUES (
      ${documentId},
      ${userId},
      ${content},
      ${JSON.stringify(metadata)}::jsonb,
      NOW(),
      NOW()
    )
  `);

  // Store chunks with embeddings
  for (let i = 0; i < chunks.length; i++) {
    const chunkId = nanoid();
    await db.execute(sql`
      INSERT INTO document_chunk (id, document_id, content, chunk_index, metadata, embedding, created_at)
      VALUES (
        ${chunkId},
        ${documentId},
        ${chunks[i]},
        ${i},
        ${JSON.stringify({ ...metadata, chunkIndex: i })}::jsonb,
        ${JSON.stringify(embeddings[i])}::vector,
        NOW()
      )
    `);
  }

  return documentId;
}

/**
 * Add multiple documents in batch
 */
export async function addDocuments(
  documents: Array<{ content: string; metadata?: Record<string, any> }>,
  options: AddDocumentOptions = {}
): Promise<string[]> {
  const ids: string[] = [];

  for (const doc of documents) {
    const id = await addDocument(doc.content, {
      userId: options.userId,
      metadata: doc.metadata,
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
    });
    ids.push(id);
  }

  return ids;
}

/**
 * Search for similar documents using semantic search
 * Searches both document and document_chunk tables
 */
export async function searchDocuments(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const limit = options.limit || 5;
  const minSimilarity = options.minSimilarity || 0.5;
  const userId = options.userId ?? null;

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // Format vector for pgvector - must use sql.raw() to avoid parameterization
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const userFilter = userId
    ? sql`AND user_id = ${userId}`
    : sql`AND user_id IS NULL`;

  // Search in both document and document_chunk tables
  // Use UNION to combine results from both
  const results = await db.execute(sql`
    WITH all_results AS (
      SELECT
        id,
        content,
        metadata,
        1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as similarity
      FROM document
      WHERE embedding IS NOT NULL
        ${userFilter}
        AND 1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}

      UNION ALL

      SELECT
        dc.id,
        dc.content,
        dc.metadata,
        1 - (dc.embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as similarity
      FROM document_chunk dc
      JOIN document d ON d.id = dc.document_id
      WHERE dc.embedding IS NOT NULL
        AND d.user_id ${userId ? sql`= ${userId}` : sql`IS NULL`}
        AND 1 - (dc.embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}
    )
    SELECT * FROM all_results
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);

  return results.rows.map((row: any) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata,
    similarity: parseFloat(row.similarity),
  }));
}

/**
 * Search with metadata filtering
 * Searches both document and document_chunk tables
 */
export async function searchDocumentsWithFilter(
  query: string,
  filter: Record<string, any>,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const limit = options.limit || 5;
  const minSimilarity = options.minSimilarity || 0.5;
  const userId = options.userId ?? null;

  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  // Build filter condition
  const filterConditions = Object.entries(filter).map(
    ([key, value]) => sql`metadata->>${key} = ${String(value)}`
  );

  const results = await db.execute(sql`
    WITH all_results AS (
      SELECT
        id,
        content,
        metadata,
        1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as similarity
      FROM document
      WHERE embedding IS NOT NULL
        AND user_id ${userId ? sql`= ${userId}` : sql`IS NULL`}
        AND 1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}
        AND ${sql.join(filterConditions, sql` AND `)}

      UNION ALL

      SELECT
        dc.id,
        dc.content,
        dc.metadata,
        1 - (dc.embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as similarity
      FROM document_chunk dc
      JOIN document d ON d.id = dc.document_id
      WHERE dc.embedding IS NOT NULL
        AND d.user_id ${userId ? sql`= ${userId}` : sql`IS NULL`}
        AND 1 - (dc.embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}
        AND ${sql.join(filterConditions, sql` AND `)}
    )
    SELECT * FROM all_results
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);

  return results.rows.map((row: any) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata,
    similarity: parseFloat(row.similarity),
  }));
}

/**
 * Get document by ID, optionally scoped to a user
 */
export async function getDocument(id: string, userId?: string): Promise<Document | null> {
  const results = await db.execute(sql`
    SELECT id, content, metadata, created_at, updated_at
    FROM document
    WHERE id = ${id}
    ${userId !== undefined ? sql`AND user_id = ${userId}` : sql``}
  `);

  if (results.rows.length === 0) return null;

  const row = results.rows[0] as any;
  return {
    id: row.id,
    content: row.content,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Delete document and all its chunks, optionally scoped to a user
 */
export async function deleteDocument(id: string, userId?: string): Promise<boolean> {
  // Verify ownership before deleting
  const check = await db.execute(sql`
    SELECT id FROM document WHERE id = ${id}
    ${userId !== undefined ? sql`AND user_id = ${userId}` : sql``}
  `);
  if (check.rows.length === 0) return false;
  await db.execute(sql`DELETE FROM document_chunk WHERE document_id = ${id}`);
  await db.execute(sql`DELETE FROM document WHERE id = ${id}`);
  return true;
}

/**
 * Get total document count
 */
export async function getDocumentCount(): Promise<number> {
  const results = await db.execute(sql`SELECT COUNT(*) as count FROM document`);
  return parseInt((results.rows[0] as any).count);
}

export interface ListDocumentsOptions {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  userId?: string;
}

export interface ListDocumentsResult {
  documents: Array<Document & { chunkCount: number }>;
  total: number;
  page: number;
  totalPages: number;
}

/**
 * List documents with pagination and optional filtering
 */
export async function listDocuments(
  options: ListDocumentsOptions = {}
): Promise<ListDocumentsResult> {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (options.userId !== undefined) {
    conditions.push(sql`d.user_id = ${options.userId}`);
  }
  if (options.category) {
    conditions.push(sql`d.metadata->>'category' = ${options.category}`);
  }
  if (options.search) {
    conditions.push(sql`(d.content ILIKE ${'%' + options.search + '%'} OR d.metadata::text ILIKE ${'%' + options.search + '%'})`);
  }

  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM document d ${whereClause}
  `);
  const total = parseInt((countResult.rows[0] as any).count);

  const results = await db.execute(sql`
    SELECT
      d.id,
      d.content,
      d.metadata,
      d.created_at,
      d.updated_at,
      COALESCE(c.chunk_count, 0) as chunk_count
    FROM document d
    LEFT JOIN (
      SELECT document_id, COUNT(*) as chunk_count
      FROM document_chunk
      GROUP BY document_id
    ) c ON c.document_id = d.id
    ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return {
    documents: results.rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      chunkCount: parseInt(row.chunk_count),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a document with all its chunks
 */
export async function getDocumentWithChunks(id: string, userId?: string): Promise<{
  document: Document;
  chunks: DocumentChunk[];
} | null> {
  const doc = await getDocument(id, userId);
  if (!doc) return null;

  const chunkResults = await db.execute(sql`
    SELECT id, document_id, content, chunk_index, metadata, created_at
    FROM document_chunk
    WHERE document_id = ${id}
    ORDER BY chunk_index ASC
  `);

  return {
    document: doc,
    chunks: chunkResults.rows.map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      chunkIndex: row.chunk_index,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
    })),
  };
}

/**
 * Search for similar documents scoped to specific document IDs
 * Used for grounded RAG chat where the user selects specific documents
 */
export async function searchDocumentsByIds(
  query: string,
  documentIds: string[],
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  if (documentIds.length === 0) return [];

  const limit = options.limit || 5;
  const minSimilarity = options.minSimilarity || 0.5;

  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  // Build the IN clause for document IDs
  const idList = sql.join(
    documentIds.map((id) => sql`${id}`),
    sql`, `
  );

  const results = await db.execute(sql`
    WITH all_results AS (
      SELECT
        id,
        content,
        metadata,
        1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as similarity
      FROM document
      WHERE embedding IS NOT NULL
        AND id IN (${idList})
        AND 1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}

      UNION ALL

      SELECT
        id,
        content,
        metadata,
        1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as similarity
      FROM document_chunk
      WHERE embedding IS NOT NULL
        AND document_id IN (${idList})
        AND 1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}
    )
    SELECT * FROM all_results
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);

  return results.rows.map((row: any) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata,
    similarity: parseFloat(row.similarity),
  }));
}

/**
 * Get knowledge base statistics
 */
export async function getDocumentStats(userId?: string): Promise<{
  totalDocuments: number;
  totalChunks: number;
  categories: Array<{ name: string; count: number }>;
}> {
  const userFilter = userId !== undefined ? sql`WHERE user_id = ${userId}` : sql``;
  const userJoinFilter = userId !== undefined ? sql`WHERE d.user_id = ${userId}` : sql``;
  const docCount = await db.execute(sql`SELECT COUNT(*) as count FROM document ${userFilter}`);
  const chunkCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM document_chunk dc
    JOIN document d ON d.id = dc.document_id
    ${userJoinFilter}
  `);
  const categoryResults = await db.execute(sql`
    SELECT metadata->>'category' as name, COUNT(*) as count
    FROM document
    ${userId !== undefined ? sql`WHERE user_id = ${userId} AND metadata->>'category' IS NOT NULL` : sql`WHERE metadata->>'category' IS NOT NULL`}
    GROUP BY metadata->>'category'
    ORDER BY count DESC
  `);

  return {
    totalDocuments: parseInt((docCount.rows[0] as any).count),
    totalChunks: parseInt((chunkCount.rows[0] as any).count),
    categories: categoryResults.rows.map((row: any) => ({
      name: row.name || 'uncategorized',
      count: parseInt(row.count),
    })),
  };
}
