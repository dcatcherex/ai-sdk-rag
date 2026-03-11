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
import { rerankResults } from './rerank';

export interface Document {
  id: string;
  content: string;
  originalContent?: string | null;
  processingStatus: string;
  processingMode?: string | null;
  storageMode?: string | null;
  analysisResult?: Record<string, any> | null;
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
  page?: number | null;
  section?: string;
  fileName?: string;
  /** Parent document ID — present on chunked (RAG-mode) results for OP-RAG ordering */
  documentId?: string;
  /** Position of this chunk within its parent document — used for OP-RAG ordering */
  chunkIndex?: number | null;
}

export interface AddDocumentOptions {
  userId?: string;
  metadata?: Record<string, any>;
  chunkSize?: number;
  chunkOverlap?: number;
}

export type StorageMode = 'rag' | 'context';

// Context injection threshold based on 2026 research findings:
// Documents under ~40,000 tokens (160,000 chars) benefit from direct context injection
// rather than chunking — preserves document coherence and avoids fragmentation.
// Above this threshold, RAG chunking is used for cost and latency efficiency.
const CONTEXT_THRESHOLD = 160_000;

/**
 * Create a pending document placeholder before processing.
 * Returns the document ID to be referenced during the finalize step.
 */
export async function createPendingDocument(
  originalContent: string,
  options: AddDocumentOptions = {}
): Promise<string> {
  const documentId = nanoid();
  const metadata = options.metadata || {};
  const userId = options.userId ?? null;

  await db.execute(sql`
    INSERT INTO document (id, user_id, content, original_content, processing_status, metadata, created_at, updated_at)
    VALUES (
      ${documentId},
      ${userId},
      ${''},
      ${originalContent},
      ${'pending'},
      ${JSON.stringify(metadata)}::jsonb,
      NOW(),
      NOW()
    )
  `);

  return documentId;
}

/**
 * Finalize a pending document: embed, chunk if needed, and mark as ready.
 * Determines storage mode automatically based on content length.
 */
export async function finalizeDocument(
  id: string,
  cleanedContent: string,
  originalContent: string,
  options: AddDocumentOptions = {}
): Promise<void> {
  const storageMode: StorageMode = cleanedContent.length > CONTEXT_THRESHOLD ? 'rag' : 'context';

  if (storageMode === 'context') {
    // Retrieve metadata for contextual embedding
    const docRow = await db.execute(sql`SELECT metadata FROM document WHERE id = ${id}`);
    const ctxMeta = (docRow.rows[0] as any)?.metadata || {};
    const contextualContent = buildContextualText(cleanedContent, {
      title: ctxMeta.title,
      fileName: ctxMeta.fileName,
      category: ctxMeta.category,
    });
    const embedding = await generateEmbedding(contextualContent);
    await db.execute(sql`
      UPDATE document SET
        content = ${cleanedContent},
        original_content = ${originalContent},
        processing_status = ${'ready'},
        storage_mode = ${'context'},
        embedding = ${JSON.stringify(embedding)}::vector,
        updated_at = NOW()
      WHERE id = ${id}
    `);
  } else {
    // Store full content without embedding, chunk separately
    await db.execute(sql`
      UPDATE document SET
        content = ${cleanedContent},
        original_content = ${originalContent},
        processing_status = ${'ready'},
        storage_mode = ${'rag'},
        updated_at = NOW()
      WHERE id = ${id}
    `);

    const chunks = chunkText(cleanedContent, {
      chunkSize: options.chunkSize || 1000,
      chunkOverlap: options.chunkOverlap || 200,
    });

    // Retrieve metadata from the document row for chunks
    const docRow = await db.execute(sql`SELECT metadata FROM document WHERE id = ${id}`);
    const metadata = (docRow.rows[0] as any)?.metadata || {};

    // Build contextual texts for embedding (Anthropic Contextual Retrieval technique):
    // prepend document-level context to each chunk so the embedding captures WHERE
    // this text comes from, not just WHAT it says. Stored content stays clean.
    const contextualTexts = chunks.map((chunk) =>
      buildContextualText(chunk, {
        title: metadata.title,
        fileName: metadata.fileName,
        category: metadata.category,
      })
    );

    const BATCH_SIZE = 20;
    const embeddings: number[][] = [];
    for (let i = 0; i < contextualTexts.length; i += BATCH_SIZE) {
      const batch = contextualTexts.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await generateEmbeddings(batch);
      embeddings.push(...batchEmbeddings);
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = nanoid();
      await db.execute(sql`
        INSERT INTO document_chunk (id, document_id, content, chunk_index, metadata, embedding, created_at)
        VALUES (
          ${chunkId},
          ${id},
          ${chunks[i]},
          ${i},
          ${JSON.stringify({ ...metadata, chunkIndex: i, contextEmbedded: true })}::jsonb,
          ${JSON.stringify(embeddings[i])}::vector,
          NOW()
        )
      `);
    }
  }
}

export interface SearchOptions {
  limit?: number;
  minSimilarity?: number;
  filter?: Record<string, any>;
  userId?: string;
  /** When true, expands the candidate pool and applies Cohere reranking. Requires COHERE_API_KEY. */
  rerank?: boolean;
}

// ---------------------------------------------------------------------------
// Reciprocal Rank Fusion (RRF) — combines vector and BM25 ranked lists.
// k=60 is the standard constant from the original RRF paper.
// Items appearing in both lists score highest; items in only one list are
// still included but score lower than dual-list items.
// ---------------------------------------------------------------------------
const RRF_K = 60;
const BM25_POOL = 60; // candidate pool size for each search method

interface RawRow {
  id: string;
  content: string;
  metadata: any;
}

function applyRRF(
  vectorRows: RawRow[],
  bm25Rows: RawRow[],
  limit: number
): Array<RawRow & { similarity: number }> {
  const vecRank = new Map<string, number>();
  const bm25Rank = new Map<string, number>();
  const rowData = new Map<string, RawRow>();

  vectorRows.forEach((row, i) => {
    vecRank.set(row.id, i + 1);
    rowData.set(row.id, row);
  });
  bm25Rows.forEach((row, i) => {
    bm25Rank.set(row.id, i + 1);
    if (!rowData.has(row.id)) rowData.set(row.id, row);
  });

  const allIds = new Set([...vecRank.keys(), ...bm25Rank.keys()]);
  return Array.from(allIds)
    .map((id) => {
      const vr = vecRank.get(id);
      const br = bm25Rank.get(id);
      const score =
        (vr !== undefined ? 1 / (RRF_K + vr) : 0) +
        (br !== undefined ? 1 / (RRF_K + br) : 0);
      return { ...rowData.get(id)!, similarity: score };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Build a contextual preamble to prepend to a chunk before embedding.
 * This follows Anthropic's Contextual Retrieval technique: enriching chunk
 * embeddings with document-level context so retrieval is far more accurate.
 *
 * The stored chunk content stays clean (for display/citations).
 * Only the text sent to the embedding model gets the preamble.
 */
function buildContextualText(
  chunkContent: string,
  ctx: {
    title?: string;
    category?: string;
    section?: string;
    page?: number | null;
    fileName?: string;
  }
): string {
  const parts: string[] = [];
  const docName = ctx.title || ctx.fileName || 'document';
  parts.push(`Document: "${docName}"`);
  if (ctx.category && ctx.category !== 'general') parts.push(`Category: ${ctx.category}`);
  if (ctx.section) parts.push(`Section: ${ctx.section}`);
  if (ctx.page != null) parts.push(`Page: ${ctx.page}`);
  return `[${parts.join(' | ')}]\n\n${chunkContent}`;
}

/** Hoist citation and ordering fields from a result row into a SearchResult */
function withCitationFields(row: any, similarity: number): SearchResult {
  const meta = row.metadata || {};
  return {
    id: row.id,
    content: row.content,
    metadata: meta,
    similarity: parseFloat(similarity as any),
    page: typeof meta.page === 'number' ? meta.page : null,
    section: typeof meta.section === 'string' ? meta.section : undefined,
    fileName: meta.fileName || meta.title || undefined,
    // OP-RAG: track parent document and chunk position for sequential re-ordering
    documentId: row.source_doc_id ?? undefined,
    chunkIndex: row.chunk_order != null ? Number(row.chunk_order) : undefined,
  };
}

/**
 * OP-RAG (Order-Preserve RAG) — re-orders retrieved chunks to match their
 * original sequential position within each source document.
 *
 * Standard RAG returns chunks sorted by relevance score, causing "context confusion"
 * when the LLM sees page 8 before page 3. OP-RAG preserves the document's logical
 * flow while still prioritising the most relevant documents first.
 *
 * Algorithm:
 *   1. Separate standalone context-mode docs (no chunkIndex) from chunks
 *   2. Group chunks by parent documentId
 *   3. Within each group, sort by chunkIndex (document order)
 *   4. Order groups by their highest-scoring chunk (relevance order)
 *   5. Return: [standalone docs] + [groups in relevance order, each internally sorted]
 */
function applyOpRAG(results: SearchResult[]): SearchResult[] {
  const standalone = results.filter((r) => r.chunkIndex == null || r.documentId == null);
  const chunks = results.filter((r) => r.chunkIndex != null && r.documentId != null);

  const docGroups = new Map<string, SearchResult[]>();
  const docBestScore = new Map<string, number>();

  for (const chunk of chunks) {
    const docId = chunk.documentId!;
    if (!docGroups.has(docId)) {
      docGroups.set(docId, []);
      // Results arrive sorted by score; first occurrence is the best score for this doc
      docBestScore.set(docId, chunk.similarity);
    }
    docGroups.get(docId)!.push(chunk);
  }

  // Sort chunks within each document by their original sequential position
  for (const group of docGroups.values()) {
    group.sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
  }

  // Order documents by their best chunk score (highest relevance first)
  const sortedDocIds = Array.from(docGroups.keys()).sort(
    (a, b) => (docBestScore.get(b) ?? 0) - (docBestScore.get(a) ?? 0)
  );

  return [
    ...standalone,
    ...sortedDocIds.flatMap((docId) => docGroups.get(docId)!),
  ];
}

/**
 * Delete all chunks for a document without deleting the document itself.
 * Used for reprocessing.
 */
export async function deleteDocumentChunks(id: string): Promise<void> {
  await db.execute(sql`DELETE FROM document_chunk WHERE document_id = ${id}`);
}

/**
 * Finalize a document processed in Precise mode.
 * Stores pre-built chunks (with page/section metadata) and generates embeddings.
 */
export async function finalizeDocumentPrecise(
  id: string,
  chunks: Array<{ content: string; page: number | null; section: string; chunkIndex: number }>,
  metadata: Record<string, any> = {},
): Promise<void> {
  // Build joined content for the document row
  const fullContent = chunks.map((c) => c.content).join('\n\n');

  // Update document row — always RAG mode for Precise (chunks carry structure)
  await db.execute(sql`
    UPDATE document SET
      content = ${fullContent},
      processing_status = ${'ready'},
      storage_mode = ${'rag'},
      updated_at = NOW()
    WHERE id = ${id}
  `);

  // Embed chunks in batches using contextual text (Anthropic Contextual Retrieval):
  // each chunk gets a preamble with document title + page + section so the embedding
  // knows WHERE this passage sits in the document. Stored content stays clean.
  const BATCH_SIZE = 20;
  const contextualTexts = chunks.map((c) =>
    buildContextualText(c.content, {
      title: metadata.title,
      fileName: metadata.fileName || metadata.title,
      category: metadata.category,
      section: c.section,
      page: c.page,
    })
  );
  const embeddings: number[][] = [];
  for (let i = 0; i < contextualTexts.length; i += BATCH_SIZE) {
    const batch = contextualTexts.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await generateEmbeddings(batch);
    embeddings.push(...batchEmbeddings);
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const chunkId = nanoid();
    const chunkMeta = {
      ...metadata,
      chunkIndex: chunk.chunkIndex,
      page: chunk.page,
      section: chunk.section,
      fileName: metadata.fileName || metadata.title || '',
      contextEmbedded: true,
    };
    await db.execute(sql`
      INSERT INTO document_chunk (id, document_id, content, chunk_index, metadata, embedding, created_at)
      VALUES (
        ${chunkId},
        ${id},
        ${chunk.content},
        ${chunk.chunkIndex},
        ${JSON.stringify(chunkMeta)}::jsonb,
        ${JSON.stringify(embeddings[i])}::vector,
        NOW()
      )
    `);
  }
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
 * Search for similar documents using hybrid vector + BM25 search.
 * Results are merged with Reciprocal Rank Fusion (RRF).
 */
export async function searchDocuments(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const limit = options.limit || 5;
  const minSimilarity = options.minSimilarity || 0.5;
  const userId = options.userId ?? null;

  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const userDocFilter = userId ? sql`AND user_id = ${userId}` : sql`AND user_id IS NULL`;
  const userChunkFilter = userId ? sql`AND d.user_id = ${userId}` : sql`AND d.user_id IS NULL`;

  // --- Vector search ---
  const vecResult = await db.execute(sql`
    SELECT id, content, metadata
    FROM (
      SELECT id, content, metadata,
        1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as score
      FROM document
      WHERE embedding IS NOT NULL ${userDocFilter}
        AND (processing_status = 'ready' OR processing_status IS NULL)
        AND 1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}

      UNION ALL

      SELECT dc.id, dc.content, dc.metadata,
        1 - (dc.embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as score
      FROM document_chunk dc
      JOIN document d ON d.id = dc.document_id
      WHERE dc.embedding IS NOT NULL ${userChunkFilter}
        AND (d.processing_status = 'ready' OR d.processing_status IS NULL)
        AND 1 - (dc.embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}
    ) t
    ORDER BY score DESC
    LIMIT ${BM25_POOL}
  `);

  // --- BM25 full-text search ---
  const bm25Result = await db.execute(sql`
    SELECT id, content, metadata
    FROM (
      SELECT id, content, metadata,
        ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', ${query})) as score
      FROM document
      WHERE (processing_status = 'ready' OR processing_status IS NULL)
        ${userDocFilter}
        AND to_tsvector('english', content) @@ plainto_tsquery('english', ${query})

      UNION ALL

      SELECT dc.id, dc.content, dc.metadata,
        ts_rank_cd(to_tsvector('english', dc.content), plainto_tsquery('english', ${query})) as score
      FROM document_chunk dc
      JOIN document d ON d.id = dc.document_id
      WHERE (d.processing_status = 'ready' OR d.processing_status IS NULL)
        ${userChunkFilter}
        AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', ${query})
    ) t
    ORDER BY score DESC
    LIMIT ${BM25_POOL}
  `);

  const merged = applyRRF(vecResult.rows as unknown as RawRow[], bm25Result.rows as unknown as RawRow[], limit);
  return merged.map((row) => withCitationFields(row, row.similarity));
}

/**
 * Search with metadata filtering using hybrid vector + BM25, merged via RRF.
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

  const filterConditions = Object.entries(filter).map(
    ([key, value]) => sql`metadata->>${key} = ${String(value)}`
  );
  const filterClause = filterConditions.length > 0
    ? sql`AND ${sql.join(filterConditions, sql` AND `)}`
    : sql``;

  const userDocFilter = userId ? sql`AND user_id = ${userId}` : sql`AND user_id IS NULL`;
  const userChunkFilter = userId ? sql`AND d.user_id = ${userId}` : sql`AND d.user_id IS NULL`;

  // --- Vector search ---
  const vecResult = await db.execute(sql`
    SELECT id, content, metadata
    FROM (
      SELECT id, content, metadata,
        1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as score
      FROM document
      WHERE embedding IS NOT NULL ${userDocFilter}
        AND (processing_status = 'ready' OR processing_status IS NULL)
        AND 1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}
        ${filterClause}

      UNION ALL

      SELECT dc.id, dc.content, dc.metadata,
        1 - (dc.embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as score
      FROM document_chunk dc
      JOIN document d ON d.id = dc.document_id
      WHERE dc.embedding IS NOT NULL ${userChunkFilter}
        AND (d.processing_status = 'ready' OR d.processing_status IS NULL)
        AND 1 - (dc.embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}
        ${filterClause}
    ) t
    ORDER BY score DESC
    LIMIT ${BM25_POOL}
  `);

  // --- BM25 full-text search ---
  const bm25Result = await db.execute(sql`
    SELECT id, content, metadata
    FROM (
      SELECT id, content, metadata,
        ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', ${query})) as score
      FROM document
      WHERE (processing_status = 'ready' OR processing_status IS NULL)
        ${userDocFilter}
        AND to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
        ${filterClause}

      UNION ALL

      SELECT dc.id, dc.content, dc.metadata,
        ts_rank_cd(to_tsvector('english', dc.content), plainto_tsquery('english', ${query})) as score
      FROM document_chunk dc
      JOIN document d ON d.id = dc.document_id
      WHERE (d.processing_status = 'ready' OR d.processing_status IS NULL)
        ${userChunkFilter}
        AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', ${query})
        ${filterClause}
    ) t
    ORDER BY score DESC
    LIMIT ${BM25_POOL}
  `);

  const merged = applyRRF(vecResult.rows as unknown as RawRow[], bm25Result.rows as unknown as RawRow[], limit);
  return merged.map((row) => withCitationFields(row, row.similarity));
}

/**
 * Get document by ID, optionally scoped to a user
 */
export async function getDocument(id: string, userId?: string): Promise<Document | null> {
  const results = await db.execute(sql`
    SELECT id, content, original_content, processing_status, processing_mode, storage_mode, analysis_result, metadata, created_at, updated_at
    FROM document
    WHERE id = ${id}
    ${userId !== undefined ? sql`AND user_id = ${userId}` : sql``}
  `);

  if (results.rows.length === 0) return null;

  const row = results.rows[0] as any;
  return {
    id: row.id,
    content: row.content,
    originalContent: row.original_content,
    processingStatus: row.processing_status ?? 'ready',
    processingMode: row.processing_mode,
    storageMode: row.storage_mode,
    analysisResult: row.analysis_result,
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
  processingMode?: string;
  sortBy?: 'name' | 'category' | 'mode' | 'chunks' | 'date';
  sortDir?: 'asc' | 'desc';
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
  if (options.processingMode) {
    conditions.push(sql`d.processing_mode = ${options.processingMode}`);
  }

  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM document d ${whereClause}
  `);
  const total = parseInt((countResult.rows[0] as any).count);

  const orderByColMap: Record<string, ReturnType<typeof sql>> = {
    name: sql`d.metadata->>'title'`,
    category: sql`d.metadata->>'category'`,
    mode: sql`d.processing_mode`,
    chunks: sql`COALESCE(c.chunk_count, 0)`,
    date: sql`d.created_at`,
  };
  const orderByCol = orderByColMap[options.sortBy || 'date'] ?? orderByColMap.date;
  const orderByDir = options.sortDir === 'asc' ? sql`ASC` : sql`DESC`;

  const results = await db.execute(sql`
    SELECT
      d.id,
      d.content,
      d.original_content,
      d.processing_status,
      d.processing_mode,
      d.storage_mode,
      d.analysis_result,
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
    ORDER BY ${orderByCol} ${orderByDir}
    LIMIT ${limit} OFFSET ${offset}
  `);

  return {
    documents: results.rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      originalContent: row.original_content,
      processingStatus: row.processing_status ?? 'ready',
      processingMode: row.processing_mode,
      storageMode: row.storage_mode,
      analysisResult: row.analysis_result,
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
 * Search for similar documents scoped to specific document IDs using hybrid
 * vector + BM25 search merged via Reciprocal Rank Fusion (RRF).
 * Used for grounded RAG chat where the user selects specific documents.
 */
export async function searchDocumentsByIds(
  query: string,
  documentIds: string[],
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  if (documentIds.length === 0) return [];

  const limit = options.limit || 5;
  const minSimilarity = options.minSimilarity || 0.5;
  const useRerank = options.rerank ?? false;
  // When reranking, retrieve a wider candidate pool (top 20) for the reranker to score
  const candidatePool = useRerank ? Math.max(20, limit * 4) : limit;

  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const idList = sql.join(documentIds.map((id) => sql`${id}`), sql`, `);

  // --- Vector search (includes source_doc_id + chunk_order for OP-RAG) ---
  const vecResult = await db.execute(sql`
    SELECT id, content, metadata, source_doc_id, chunk_order
    FROM (
      -- Context-mode documents: entire doc is a single result; no chunk order
      SELECT id, content, metadata,
        id AS source_doc_id,
        NULL::integer AS chunk_order,
        1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as score
      FROM document
      WHERE embedding IS NOT NULL
        AND id IN (${idList})
        AND (processing_status = 'ready' OR processing_status IS NULL)
        AND 1 - (embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}

      UNION ALL

      -- RAG-mode chunks: carry parent document ID and sequential chunk index
      SELECT dc.id, dc.content, dc.metadata,
        dc.document_id AS source_doc_id,
        (dc.metadata->>'chunkIndex')::integer AS chunk_order,
        1 - (dc.embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) as score
      FROM document_chunk dc
      JOIN document d ON d.id = dc.document_id
      WHERE dc.embedding IS NOT NULL
        AND dc.document_id IN (${idList})
        AND (d.processing_status = 'ready' OR d.processing_status IS NULL)
        AND 1 - (dc.embedding <=> ${sql.raw(`'${vectorStr}'::vector`)}) > ${minSimilarity}
    ) t
    ORDER BY score DESC
    LIMIT ${BM25_POOL}
  `);

  // --- BM25 full-text search (same source_doc_id + chunk_order fields) ---
  const bm25Result = await db.execute(sql`
    SELECT id, content, metadata, source_doc_id, chunk_order
    FROM (
      SELECT id, content, metadata,
        id AS source_doc_id,
        NULL::integer AS chunk_order,
        ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', ${query})) as score
      FROM document
      WHERE id IN (${idList})
        AND (processing_status = 'ready' OR processing_status IS NULL)
        AND to_tsvector('english', content) @@ plainto_tsquery('english', ${query})

      UNION ALL

      SELECT dc.id, dc.content, dc.metadata,
        dc.document_id AS source_doc_id,
        (dc.metadata->>'chunkIndex')::integer AS chunk_order,
        ts_rank_cd(to_tsvector('english', dc.content), plainto_tsquery('english', ${query})) as score
      FROM document_chunk dc
      JOIN document d ON d.id = dc.document_id
      WHERE dc.document_id IN (${idList})
        AND (d.processing_status = 'ready' OR d.processing_status IS NULL)
        AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', ${query})
    ) t
    ORDER BY score DESC
    LIMIT ${BM25_POOL}
  `);

  // Merge with RRF — use candidatePool as the initial cut before optional reranking
  const merged = applyRRF(
    vecResult.rows as unknown as RawRow[],
    bm25Result.rows as unknown as RawRow[],
    candidatePool
  ).map((row) => withCitationFields(row, row.similarity));

  // Rerank the candidate pool with Cohere cross-encoder, then trim to final limit
  const scored = useRerank ? await rerankResults(query, merged, limit) : merged.slice(0, limit);

  // OP-RAG: re-order chunks from the same document to their original sequential
  // position, preventing "context confusion" from out-of-order chunk presentation.
  return applyOpRAG(scored);
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
