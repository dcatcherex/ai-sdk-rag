/**
 * Embeddings Service
 *
 * Generates vector embeddings using Vercel AI Gateway.
 * Using Voyage AI for best semantic search quality with modern LLMs.
 *
 * Available models:
 * - voyage/voyage-3-large (1024 dims) - ⭐ Current: Best for RAG and modern LLMs
 * - openai/text-embedding-3-small (1536 dims) - Good all-rounder, cost-effective
 * - openai/text-embedding-3-large (3072 dims) - Highest accuracy, more expensive
 */

import { embed, embedMany } from 'ai';

// Configuration - Using Vercel AI Gateway (no separate API key needed!)
const EMBEDDING_MODEL = 'mistral/mistral-embed'; // 1024 dimensions

// Using Mistral because:
// - Supports 1024 dimensions (matches our existing vectors in DB)
// - Available via AI Gateway (no extra API keys)
// - Good quality for semantic search

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

/**
 * Generate embedding for a single text
 * Uses Vercel AI Gateway with your AI_GATEWAY_API_KEY
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  // Validate input
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error(`Invalid text for embedding: ${typeof text} - "${text}"`);
  }

  const model = options.model || EMBEDDING_MODEL;

  try {
    // Using AI Gateway - model string is automatically routed
    const { embedding } = await embed({
      model, // e.g., 'openai/text-embedding-3-small' or 'voyage/voyage-3-large'
      value: text,
      experimental_telemetry: {
        isEnabled: true,
      },
    });

    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    console.error('Model:', model);
    console.error('Text:', text?.substring(0, 100));
    console.error('Text type:', typeof text);
    console.error('AI_GATEWAY_API_KEY present:', !!process.env.AI_GATEWAY_API_KEY);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than calling generateEmbedding() multiple times
 */
export async function generateEmbeddings(
  texts: string[],
  options: EmbeddingOptions = {}
): Promise<number[][]> {
  const model = options.model || EMBEDDING_MODEL;

  try {
    // Using AI Gateway for batch embeddings
    const { embeddings } = await embedMany({
      model, // e.g., 'openai/text-embedding-3-small' or 'voyage/voyage-3-large'
      values: texts,
      experimental_telemetry: {
        isEnabled: true,
      },
    });

    return embeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    console.error('Model:', model);
    console.error('Texts count:', texts.length);
    console.error('AI_GATEWAY_API_KEY present:', !!process.env.AI_GATEWAY_API_KEY);
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Chunk text into smaller pieces for embedding
 * Uses simple character-based chunking with overlap
 */
export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
}

export function chunkText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    separator = '\n\n',
  } = options;

  // Split by separator first (e.g., paragraphs)
  const paragraphs = text.split(separator).filter(p => p.trim().length > 0);

  // Further split any oversized paragraphs by sentence/newline/word boundaries
  const segments: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= chunkSize) {
      segments.push(paragraph);
    } else {
      // Try splitting by single newline, then sentence boundaries, then force-split
      const subParts = paragraph.split(/\n/).filter(s => s.trim().length > 0);
      for (const sub of subParts) {
        if (sub.length <= chunkSize) {
          segments.push(sub);
        } else {
          // Force-split at chunkSize boundaries on word breaks
          let remaining = sub;
          while (remaining.length > chunkSize) {
            let splitAt = remaining.lastIndexOf(' ', chunkSize);
            if (splitAt <= 0) splitAt = chunkSize;
            segments.push(remaining.slice(0, splitAt).trim());
            remaining = remaining.slice(splitAt).trim();
          }
          if (remaining.length > 0) segments.push(remaining);
        }
      }
    }
  }

  const chunks: string[] = [];
  let currentChunk = '';

  for (const segment of segments) {
    if (currentChunk.length + segment.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());

      // Start new chunk with overlap from the end of the previous chunk
      const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
      currentChunk = currentChunk.substring(overlapStart) + ' ' + segment;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + segment;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
