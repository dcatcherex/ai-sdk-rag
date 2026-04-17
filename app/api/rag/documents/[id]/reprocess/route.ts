import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { finalizeDocument, finalizeDocumentPrecise, deleteDocumentChunks } from '@/lib/vector-store';
import { cleanDocument } from '@/lib/document-cleaner';
import { extractDocumentPrecise, DEFAULT_PRECISE_MODEL } from '@/lib/document-precise';
import { downloadObject } from '@/lib/r2';

async function getSessionUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
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
    const { processingMode, modelId } = await req.json() as {
      processingMode: 'precise' | 'optimized' | 'raw';
      modelId?: string;
    };

    if (!processingMode || !['precise', 'optimized', 'raw'].includes(processingMode)) {
      return NextResponse.json({ error: 'Invalid processingMode' }, { status: 400 });
    }

    // Fetch document (ownership check — must be ready, not already pending)
    const rows = await db.execute(sql`
      SELECT id, content, original_content, r2_key, metadata
      FROM document
      WHERE id = ${id} AND user_id = ${userId}
    `);

    if (rows.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const doc = rows.rows[0] as any;
    const originalContent: string = doc.original_content || doc.content || '';
    const docMetadata: Record<string, any> = doc.metadata || {};

    // Mark as reprocessing to block concurrent submissions
    await db.execute(sql`
      UPDATE document SET processing_status = ${'pending'}, updated_at = NOW() WHERE id = ${id}
    `);

    // Delete existing chunks
    await deleteDocumentChunks(id);

    try {
      if (processingMode === 'precise') {
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

        const extraction = await extractDocumentPrecise(
          fileBytes,
          mimeType,
          visionModelId,
          docMetadata.fileName || docMetadata.title || 'document',
        );

        await finalizeDocumentPrecise(id, extraction.chunks, docMetadata);
        await db.execute(sql`
          UPDATE document SET
            processing_mode = ${'precise'},
            metadata = metadata || ${JSON.stringify({ processingMode: 'precise', visionModelId })}::jsonb
          WHERE id = ${id}
        `);
        return NextResponse.json({ success: true, processingMode: 'precise', chunkCount: extraction.chunks.length });

      } else if (processingMode === 'optimized') {
        let cleanedContent = originalContent;
        try {
          const cleanResult = await cleanDocument(originalContent);
          cleanedContent = cleanResult.cleanedContent;
        } catch (err) {
          console.error('Cleaning failed during reprocess, using original:', err);
        }
        await finalizeDocument(id, cleanedContent, originalContent);
        await db.execute(sql`
          UPDATE document SET
            processing_mode = ${'optimized'},
            metadata = metadata || ${JSON.stringify({ processingMode: 'optimized' })}::jsonb
          WHERE id = ${id}
        `);
        return NextResponse.json({ success: true, processingMode: 'optimized' });

      } else {
        await finalizeDocument(id, originalContent, originalContent);
        await db.execute(sql`
          UPDATE document SET
            processing_mode = ${'raw'},
            metadata = metadata || ${JSON.stringify({ processingMode: 'raw' })}::jsonb
          WHERE id = ${id}
        `);
        return NextResponse.json({ success: true, processingMode: 'raw' });
      }
    } catch (err) {
      // On failure, restore to ready with original content
      await db.execute(sql`UPDATE document SET processing_status = ${'ready'}, updated_at = NOW() WHERE id = ${id}`);
      throw err;
    }
  } catch (error) {
    console.error('Reprocess document error:', error);
    return NextResponse.json(
      { error: 'Failed to reprocess document', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
