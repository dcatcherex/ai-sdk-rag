import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { certificateTemplate } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { downloadObject } from '@/lib/r2';

async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

function getContentTypeFromKey(key: string) {
  const lowerKey = key.toLowerCase();

  if (lowerKey.endsWith('.png')) return 'image/png';
  if (lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerKey.endsWith('.pdf')) return 'application/pdf';
  if (lowerKey.endsWith('.zip')) return 'application/zip';
  return 'application/octet-stream';
}

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '_');
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const templateId = searchParams.get('templateId');
  const variant = searchParams.get('variant');
  const rawKey = searchParams.get('key');
  const download = searchParams.get('download') === '1';
  const requestedFilename = searchParams.get('filename');

  let key: string | null = null;
  let filename = requestedFilename ? sanitizeFilename(requestedFilename) : 'file';

  if (templateId) {
    const [template] = await db
      .select()
      .from(certificateTemplate)
      .where(and(eq(certificateTemplate.id, templateId), eq(certificateTemplate.userId, userId)));

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (variant === 'thumbnail') {
      key = template.thumbnailKey ?? template.r2Key;
      filename = template.thumbnailKey
        ? `${sanitizeFilename(template.name)}-thumbnail.jpg`
        : `${sanitizeFilename(template.name)}.png`;
    } else {
      key = template.r2Key;
      filename = `${sanitizeFilename(template.name)}.png`;
    }
  } else if (rawKey) {
    const allowedPrefixes = [`certificates/output/${userId}/`, `certificates/zips/${userId}/`];
    if (!allowedPrefixes.some((prefix) => rawKey.startsWith(prefix))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    key = rawKey;
    if (!requestedFilename) {
      const lastSegment = rawKey.split('/').pop();
      if (lastSegment) {
        filename = sanitizeFilename(lastSegment);
      }
    }
  }

  if (!key) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  try {
    const bytes = await downloadObject(key);
    const contentType = getContentTypeFromKey(key);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load file' }, { status: 500 });
  }
}
