/**
 * Vector Search API
 *
 * GET /api/rag/search?q=query&limit=5
 *
 * Search documents using semantic similarity
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchDocuments, searchDocumentsWithFilter } from '@/lib/vector-store';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '5');
    const category = searchParams.get('category');
    const minSimilarity = parseFloat(searchParams.get('minSimilarity') || '0.5');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    let results;

    if (category) {
      results = await searchDocumentsWithFilter(
        query,
        { category },
        { limit, minSimilarity }
      );
    } else {
      results = await searchDocuments(query, { limit, minSimilarity });
    }

    return NextResponse.json({
      success: true,
      query,
      count: results.length,
      results: results.map(doc => ({
        id: doc.id,
        content: doc.content,
        similarity: doc.similarity,
        relevance: `${(doc.similarity * 100).toFixed(1)}%`,
        metadata: doc.metadata,
      })),
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
