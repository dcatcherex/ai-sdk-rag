import { auth } from '@/lib/auth';
import { uploadImage, UploadError } from '@/lib/storage/uploadImage';
import { runAddStyleReference, runRemoveStyleReference } from '@/features/brand-profile/service';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return new Response('Missing file', { status: 400 });

  try {
    const result = await uploadImage(file, {
      prefix: `brand-style/${session.user.id}`,
      optimization: { format: 'webp', quality: 90, maxWidth: 1200 },
    });
    const ctx = { userId: session.user.id };
    await runAddStyleReference({ url: result.url }, ctx);
    return Response.json({ url: result.url });
  } catch (err) {
    if (err instanceof UploadError) return new Response(err.message, { status: err.status });
    throw err;
  }
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { url } = await req.json() as { url?: string };
  if (!url) return new Response('Missing url', { status: 400 });

  const ctx = { userId: session.user.id };
  const result = await runRemoveStyleReference({ url }, ctx);
  return Response.json(result);
}
