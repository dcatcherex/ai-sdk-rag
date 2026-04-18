import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-server';
import { uploadImage, UploadError } from '@/lib/storage/uploadImage';

export async function POST(req: NextRequest) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }

  try {
    const result = await uploadImage(file, {
      prefix: 'chat-attachments',
      maxSizeBytes: 10 * 1024 * 1024,
      optimization: { format: 'webp', quality: 85, maxWidth: 2048 },
    });
    return NextResponse.json({ url: result.url });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
