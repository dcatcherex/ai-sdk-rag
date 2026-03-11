import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { listDocuments, createPendingDocument } from '@/lib/vector-store';
import { analyzeDocument, detectImageBasedPdf, isImageFileType, IMAGE_MIME_TYPES } from '@/lib/document-analysis';
import { uploadPublicObject } from '@/lib/r2';

/** Strip null bytes and control characters that PostgreSQL rejects. Keeps \t \n \r. */
function sanitizeText(text: string): string {
  return text
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
}

async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const page = parseInt(params.get('page') || '1');
    const limit = parseInt(params.get('limit') || '20');
    const category = params.get('category') || undefined;
    const search = params.get('search') || undefined;
    const processingMode = params.get('processingMode') || undefined;
    const sortBy = (params.get('sortBy') || undefined) as 'name' | 'category' | 'mode' | 'chunks' | 'date' | undefined;
    const sortDir = (params.get('sortDir') || undefined) as 'asc' | 'desc' | undefined;

    const result = await listDocuments({ page, limit, category, search, userId, processingMode, sortBy, sortDir });
    return NextResponse.json(result);
  } catch (error) {
    console.error('List documents error:', error);
    return NextResponse.json(
      { error: 'Failed to list documents' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    const text = formData.get('text') as string | null;
    const category = (formData.get('category') as string) || 'general';
    const title = formData.get('title') as string | null;
    const processingMode = (formData.get('processingMode') as string) || 'optimized';

    if (!file && !url && !text) {
      return NextResponse.json(
        { error: 'Provide a file, url, or text' },
        { status: 400 }
      );
    }

    let content = '';
    let docTitle = title || '';
    let fileType = 'text';
    let rawBuffer: ArrayBuffer | null = null; // kept for R2 upload
    let fileMimeType = 'text/plain';
    let isImageBased = false; // image file or image-only PDF
    let effectiveMode = processingMode;

    if (url) {
      docTitle = docTitle || url;
      fileType = 'url';
      const response = await fetch(url);
      const html = await response.text();
      content = sanitizeText(
        html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      );
    } else if (file) {
      docTitle = docTitle || file.name;
      const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
      fileType = ext;

      if (isImageFileType(ext)) {
        // Image file — no text extraction, force Precise mode
        rawBuffer = await file.arrayBuffer();
        fileMimeType = IMAGE_MIME_TYPES[ext] || 'image/jpeg';
        content = `[image: ${file.name}]`;
        isImageBased = true;
        effectiveMode = 'precise';
      } else if (ext === 'pdf') {
        rawBuffer = await file.arrayBuffer();
        fileMimeType = 'application/pdf';
        const { extractText } = await import('unpdf');
        const { text: pdfPages } = await extractText(rawBuffer);
        content = sanitizeText(pdfPages.join('\n'));
        // Detect image-based PDF
        if (detectImageBasedPdf(content, rawBuffer.byteLength)) {
          isImageBased = true;
          effectiveMode = 'precise';
        }
      } else if (ext === 'json') {
        const raw = sanitizeText(await file.text());
        try {
          const parsed = JSON.parse(raw);
          content = Array.isArray(parsed)
            ? parsed.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n\n')
            : JSON.stringify(parsed, null, 2);
        } catch {
          content = raw;
        }
      } else {
        content = sanitizeText(await file.text());
      }
    } else {
      docTitle = docTitle || 'Untitled document';
      content = sanitizeText(text!);
    }

    if (!content.trim()) {
      return NextResponse.json({ error: 'No content extracted from document' }, { status: 400 });
    }

    // Analyze for noise and storage recommendation
    const analysisResult = analyzeDocument(content, isImageBased);

    // Create pending document (no embedding yet — user must confirm)
    const pendingDocumentId = await createPendingDocument(content, {
      userId,
      metadata: {
        title: docTitle,
        category,
        fileType,
        fileName: file?.name,
        fileMimeType,
        source: url || 'manual',
        ingestedAt: new Date().toISOString(),
        processingMode: effectiveMode,
        isImageBased,
      },
    });

    // Store original binary in R2 for Precise mode (PDFs, images, image-based PDFs)
    let r2Key: string | null = null;
    if (rawBuffer && (effectiveMode === 'precise' || isImageBased)) {
      const ext = file?.name.split('.').pop()?.toLowerCase() || 'bin';
      r2Key = `documents/${userId}/${pendingDocumentId}/original.${ext}`;
      await uploadPublicObject({
        key: r2Key,
        body: Buffer.from(rawBuffer),
        contentType: fileMimeType,
        cacheControl: 'private, max-age=0',
      });
      await db.execute(sql`
        UPDATE document SET r2_key = ${r2Key} WHERE id = ${pendingDocumentId}
      `);
    }

    return NextResponse.json({
      success: true,
      pendingDocumentId,
      title: docTitle,
      analysisResult,
      processingMode: effectiveMode,
      isImageBased,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload document',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
