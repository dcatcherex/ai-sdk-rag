import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { listDocuments } from '@/lib/vector-store';
import {
  ingestTextDocument,
  ingestMarkdown,
  ingestJSON,
  ingestFromURL,
} from '@/lib/document-ingestion';

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

    const result = await listDocuments({ page, limit, category, search, userId });
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

    if (!file && !url && !text) {
      return NextResponse.json(
        { error: 'Provide a file, url, or text' },
        { status: 400 }
      );
    }

    let documentId: string | string[];
    let docTitle = title || '';

    if (url) {
      docTitle = docTitle || url;
      documentId = await ingestFromURL(url, {
        userId,
        category,
        metadata: { title: docTitle },
      });
    } else if (file) {
      docTitle = docTitle || file.name;
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'pdf') {
        // PDF: extract text from binary using unpdf
        const buffer = await file.arrayBuffer();
        const { extractText } = await import('unpdf');
        const { text: pdfPages } = await extractText(buffer);
        const content = sanitizeText(pdfPages.join('\n'));
        documentId = await ingestTextDocument(content, {
          userId,
          category,
          metadata: { title: docTitle, fileType: 'pdf', fileName: file.name },
        });
      } else if (ext === 'md' || ext === 'markdown') {
        const content = sanitizeText(await file.text());
        documentId = await ingestMarkdown(content, {
          userId,
          category,
          metadata: { title: docTitle, fileType: ext, fileName: file.name },
        });
      } else if (ext === 'json') {
        const raw = sanitizeText(await file.text());
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            documentId = await ingestJSON(parsed, 'content', {
              userId,
              category,
              metadata: { title: docTitle, fileType: ext, fileName: file.name },
            });
          } else {
            documentId = await ingestTextDocument(JSON.stringify(parsed, null, 2), {
              userId,
              category,
              metadata: { title: docTitle, fileType: ext, fileName: file.name },
            });
          }
        } catch {
          documentId = await ingestTextDocument(raw, {
            userId,
            category,
            metadata: { title: docTitle, fileType: ext, fileName: file.name },
          });
        }
      } else {
        // txt, csv, etc.
        const content = sanitizeText(await file.text());
        documentId = await ingestTextDocument(content, {
          userId,
          category,
          metadata: { title: docTitle, fileType: ext || 'txt', fileName: file.name },
        });
      }
    } else {
      docTitle = docTitle || 'Untitled document';
      documentId = await ingestTextDocument(sanitizeText(text!), {
        userId,
        category,
        metadata: { title: docTitle },
      });
    }

    return NextResponse.json({
      success: true,
      documentId,
      title: docTitle,
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
