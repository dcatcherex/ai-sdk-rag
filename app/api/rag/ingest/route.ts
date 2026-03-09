/**
 * Document Ingestion API
 *
 * POST /api/rag/ingest
 *
 * Upload and ingest documents into the vector store
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  ingestTextDocument,
  ingestDocuments,
  ingestMarkdown,
  ingestJSON,
  ingestFromURL
} from '@/lib/document-ingestion';

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type, content, documents, url, category, metadata } = body;

    let result;

    switch (type) {
      case 'text':
        // Single text document
        if (!content) {
          return NextResponse.json(
            { error: 'Content is required for text ingestion' },
            { status: 400 }
          );
        }
        result = await ingestTextDocument(content, { userId, category, metadata });
        return NextResponse.json({
          success: true,
          documentId: result,
          message: 'Document ingested successfully'
        });

      case 'batch':
        // Multiple documents
        if (!documents || !Array.isArray(documents)) {
          return NextResponse.json(
            { error: 'Documents array is required for batch ingestion' },
            { status: 400 }
          );
        }
        result = await ingestDocuments(documents, { userId, category, metadata });
        return NextResponse.json({
          success: true,
          documentIds: result,
          count: result.length,
          message: `${result.length} documents ingested successfully`
        });

      case 'markdown':
        // Markdown document
        if (!content) {
          return NextResponse.json(
            { error: 'Content is required for markdown ingestion' },
            { status: 400 }
          );
        }
        result = await ingestMarkdown(content, { userId, category, metadata });
        return NextResponse.json({
          success: true,
          documentIds: result,
          count: result.length,
          message: `Markdown document split into ${result.length} sections`
        });

      case 'json':
        // JSON data
        if (!documents || !Array.isArray(documents)) {
          return NextResponse.json(
            { error: 'Documents array is required for JSON ingestion' },
            { status: 400 }
          );
        }
        const contentField = body.contentField || 'content';
        result = await ingestJSON(documents, contentField, { userId, category, metadata });
        return NextResponse.json({
          success: true,
          documentIds: result,
          count: result.length,
          message: `${result.length} JSON records ingested successfully`
        });

      case 'url':
        // Fetch from URL
        if (!url) {
          return NextResponse.json(
            { error: 'URL is required for URL ingestion' },
            { status: 400 }
          );
        }
        result = await ingestFromURL(url, { userId, category, metadata });
        return NextResponse.json({
          success: true,
          documentId: result,
          message: 'Document from URL ingested successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid ingestion type. Use: text, batch, markdown, json, or url' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Ingestion error:', error);
    return NextResponse.json(
      {
        error: 'Failed to ingest document',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
