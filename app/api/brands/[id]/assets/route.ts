import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brand } from '@/db/schema';
import { getBrandAssets, createBrandAsset } from '@/features/brands/service';
import { uploadPublicObject } from '@/lib/r2';
import { uploadImage, UploadError } from '@/lib/storage/uploadImage';
import type { BrandAssetKind } from '@/features/brands/types';

const ALLOWED_KINDS = new Set<string>(['logo', 'product', 'creative', 'document', 'font', 'other']);

type Params = { params: Promise<{ id: string }> };

async function verifyOwnership(userId: string, brandId: string) {
  const [row] = await db
    .select({ id: brand.id })
    .from(brand)
    .where(and(eq(brand.id, brandId), eq(brand.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await verifyOwnership(session.user.id, id))) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const assets = await getBrandAssets(id);
  return Response.json(assets);
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await verifyOwnership(session.user.id, id))) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return Response.json({ error: 'file is required' }, { status: 400 });

  const rawKind = (formData.get('kind') as string) || 'other';
  const kind: BrandAssetKind = ALLOWED_KINDS.has(rawKind) ? (rawKind as BrandAssetKind) : 'other';
  const title = ((formData.get('title') as string) || file.name).trim().slice(0, 200);
  const collection = ((formData.get('collection') as string) || '').trim() || null;

  let r2Key: string;
  let url: string;
  let mimeType: string;
  let sizeBytes: number;

  if (file.type.startsWith('image/')) {
    try {
      const result = await uploadImage(file, {
        prefix: `brand-assets/${id}`,
        optimization: { format: 'webp', quality: 90, maxWidth: 2048 },
        maxSizeBytes: 5 * 1024 * 1024,
      });
      r2Key = result.key;
      url = result.url;
      mimeType = result.contentType;
      sizeBytes = result.optimizedSize;
    } catch (err) {
      if (err instanceof UploadError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  } else {
    const ext = file.name.split('.').pop() ?? 'bin';
    r2Key = `brand-assets/${id}/${nanoid()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadPublicObject({ key: r2Key, body: buffer, contentType: file.type });
    url = uploaded.url;
    mimeType = file.type;
    sizeBytes = file.size;
  }

  const asset = await createBrandAsset({
    brandId: id,
    kind,
    collection,
    title,
    r2Key,
    url,
    mimeType,
    sizeBytes,
    metadata: {},
    sortOrder: 0,
  });

  return Response.json(asset, { status: 201 });
}
