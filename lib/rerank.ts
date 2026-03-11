/**
 * Cohere Reranker
 *
 * Cross-encoder reranking: unlike embeddings which encode query and document
 * independently, a reranker reads (query, document) pairs together — much more
 * accurate but slower. Use after hybrid retrieval on large knowledge bases.
 *
 * Requires: COHERE_API_KEY in environment.
 * Free tier: 1,000 rerank calls/month (sufficient for most personal KBs).
 */

import type { SearchResult } from './vector-store';

const RERANK_MODEL = 'rerank-english-v3.0';
const COHERE_RERANK_URL = 'https://api.cohere.com/v2/rerank';

/**
 * Rerank a list of search results against the original query.
 * Returns the top `topN` results ordered by reranker score.
 *
 * Falls back to the original order if COHERE_API_KEY is missing or the API fails.
 */
export async function rerankResults(
  query: string,
  results: SearchResult[],
  topN: number
): Promise<SearchResult[]> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey || results.length === 0) return results.slice(0, topN);

  try {
    const response = await fetch(COHERE_RERANK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: RERANK_MODEL,
        query,
        documents: results.map((r) => r.content),
        top_n: topN,
      }),
    });

    if (!response.ok) {
      console.error('Cohere rerank failed:', response.status, await response.text());
      return results.slice(0, topN);
    }

    const data = await response.json() as {
      results: Array<{ index: number; relevance_score: number }>;
    };

    return data.results.map((r) => ({
      ...results[r.index]!,
      similarity: r.relevance_score,
    }));
  } catch (err) {
    console.error('Cohere rerank error:', err);
    return results.slice(0, topN);
  }
}
