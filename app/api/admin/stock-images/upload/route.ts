import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { uploadImage, UploadError } from '@/lib/storage/uploadImage';

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  try {
    const result = await uploadImage(file, {
      prefix: 'stock-images',
      maxSizeBytes: 10 * 1024 * 1024,
      optimization: { format: 'webp', quality: 90, maxWidth: 2048 },
    });
    return NextResponse.json({ url: result.url });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
