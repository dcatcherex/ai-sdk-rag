import { getCurrentUser } from '@/lib/auth-server';
import { uploadImage, UploadError } from '@/lib/storage/uploadImage';
import { deletePublicObject } from '@/lib/r2';
import { listBrandPhotos, saveBrandPhoto, deleteBrandPhoto } from '@/features/brand-photos/service';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId') ?? undefined;

  const photos = await listBrandPhotos(brandId ? { brandId } : { userId: user.id });
  return Response.json({ photos });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  const tagsRaw = formData.get('tags');
  const brandId = formData.get('brandId');

  if (!(file instanceof File)) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  const tags = tagsRaw
    ? String(tagsRaw).split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const ctx = brandId
    ? { userId: user.id, brandId: String(brandId) }
    : { userId: user.id };

  try {
    const uploaded = await uploadImage(file, {
      prefix: `brand-photos/${brandId ?? user.id}`,
      optimization: { format: 'webp', quality: 88, maxWidth: 1600 },
      maxSizeBytes: 10 * 1024 * 1024,
    });

    const photo = await saveBrandPhoto(
      ctx,
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

  const { id, brandId } = await req.json() as { id: string; brandId?: string };
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const ctx = brandId ? { userId: user.id, brandId } : { userId: user.id };
  const r2Key = await deleteBrandPhoto(id, ctx);
  if (!r2Key) return Response.json({ error: 'Not found' }, { status: 404 });

  await deletePublicObject(r2Key);
  return Response.json({ deleted: true });
}
