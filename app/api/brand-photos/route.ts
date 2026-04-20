import { getCurrentUser } from '@/lib/auth-server';
import { uploadImage, UploadError } from '@/lib/storage/uploadImage';
import { deletePublicObject } from '@/lib/r2';
import { listBrandPhotos, saveBrandPhoto, deleteBrandPhoto } from '@/features/brand-photos/service';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const photos = await listBrandPhotos({ userId: user.id });
  return Response.json({ photos });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  const tagsRaw = formData.get('tags');

  if (!(file instanceof File)) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  const tags = tagsRaw
    ? String(tagsRaw).split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  try {
    const uploaded = await uploadImage(file, {
      prefix: `brand-photos/${user.id}`,
      optimization: { format: 'webp', quality: 88, maxWidth: 1600 },
      maxSizeBytes: 10 * 1024 * 1024, // 10 MB — activity photos can be larger
    });

    const photo = await saveBrandPhoto(
      { userId: user.id },
      { url: uploaded.url, r2Key: uploaded.key, filename: file.name, tags },
    );

    return Response.json({ photo });
  } catch (err) {
    if (err instanceof UploadError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const r2Key = await deleteBrandPhoto(id, { userId: user.id });
  if (!r2Key) return Response.json({ error: 'Not found' }, { status: 404 });

  await deletePublicObject(r2Key);
  return Response.json({ deleted: true });
}
