import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { finalizeDocument, finalizeDocumentPrecise } from '@/lib/vector-store';
import { cleanDocument } from '@/lib/document-cleaner';
import { extractDocumentPrecise, DEFAULT_PRECISE_MODEL } from '@/lib/document-precise';
import { downloadObject } from '@/lib/r2';

async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { action, modelId } = await req.json() as {
      action: 'clean_and_save' | 'save_as_is' | 'precise';
      modelId?: string;
    };

    if (!action || !['clean_and_save', 'save_as_is', 'precise'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Fetch the pending document (ownership check)
    const rows = await db.execute(sql`
      SELECT id, original_content, r2_key, metadata
      FROM document
      WHERE id = ${id} AND user_id = ${userId} AND processing_status = 'pending'
    `);

    if (rows.rows.length === 0) {
      return NextResponse.json({ error: 'Pending document not found' }, { status: 404 });
    }

    const doc = rows.rows[0] as any;
    const originalContent: string = doc.original_content || '';
    const docMetadata: Record<string, any> = doc.metadata || {};

    if (action === 'precise') {
      const visionModelId = modelId || DEFAULT_PRECISE_MODEL;
      const r2Key: string | null = doc.r2_key || null;
      let fileBytes: Uint8Array;
      let mimeType: string;

      if (r2Key) {
        fileBytes = await downloadObject(r2Key);
        mimeType = docMetadata.fileMimeType || 'application/pdf';
      } else {
        fileBytes = new TextEncoder().encode(originalContent);
        mimeType = 'text/plain';
      }

      let extraction;
      try {
        extraction = await extractDocumentPrecise(
          fileBytes,
          mimeType,
          visionModelId,
          docMetadata.fileName || docMetadata.title || 'document',
        );
      } catch (err) {
        // Fallback to save_as_is if extraction fails
        console.error('Precise extraction failed, falling back to save_as_is:', err);
        await finalizeDocument(id, originalContent, originalContent);
        return NextResponse.json({ success: true, action: 'saved_as_is_fallback', fallbackReason: 'precise_extraction_failed' });
      }

      await finalizeDocumentPrecise(id, extraction.chunks, docMetadata);
      await db.execute(sql`
        UPDATE document SET
          processing_mode = ${'precise'},
          metadata = metadata || ${JSON.stringify({ processingMode: 'precise', visionModelId })}::jsonb
        WHERE id = ${id}
      `);
      return NextResponse.json({ success: true, action: 'precise', chunkCount: extraction.chunks.length });
    } else if (action === 'clean_and_save') {
      let cleanedContent = originalContent;
      let actualAction = 'clean_and_save';

      try {
        const cleanResult = await cleanDocument(originalContent);
        cleanedContent = cleanResult.cleanedContent;
      } catch (err) {
        // Fallback: save as-is if cleaning fails
        console.error('Document cleaning failed, saving original:', err);
        actualAction = 'saved_as_is_fallback';
      }

      await finalizeDocument(id, cleanedContent, originalContent);
      await db.execute(sql`UPDATE document SET processing_mode = ${'optimized'} WHERE id = ${id}`);
      return NextResponse.json({ success: true, action: actualAction });
    } else {
      await finalizeDocument(id, originalContent, originalContent);
      await db.execute(sql`UPDATE document SET processing_mode = ${'raw'} WHERE id = ${id}`);
      return NextResponse.json({ success: true, action: 'save_as_is' });
    }
  } catch (error) {
    console.error('Process document error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process document',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
