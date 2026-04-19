import { auth } from '@/lib/auth';
import { uploadImage, UploadError } from '@/lib/storage/uploadImage';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return new Response('Missing file', { status: 400 });

  try {
    const result = await uploadImage(file, {
      prefix: `brand-logo/${session.user.id}`,
      optimization: { format: 'webp', quality: 95, maxWidth: 400 },
    });
    return Response.json({ url: result.url });
  } catch (err) {
    if (err instanceof UploadError) return new Response(err.message, { status: err.status });
    throw err;
  }
}
