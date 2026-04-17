import { NextResponse } from 'next/server';

import { requireUser } from "@/lib/auth-server";
import { uploadImage, UploadError } from '@/lib/storage/uploadImage';

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
      prefix: `agent-covers/${authResult.user.id}`,
      optimization: { format: 'webp', quality: 85, maxWidth: 1200 },
    });

    return NextResponse.json({ url: result.url });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
