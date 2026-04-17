import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { uploadImage } from '@/lib/storage/uploadImage';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  try {
    const result = await uploadImage(file, {
      prefix: `skill-covers/${authResult.user.id}`,
      optimization: { format: 'webp', quality: 85, maxWidth: 1200 },
      maxSizeBytes: 5 * 1024 * 1024,
    });
    return NextResponse.json({ url: result.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
