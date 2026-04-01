import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { lineOaChannel, lineRichMenu } from '@/db/schema';
import { uploadPublicObject } from '@/lib/r2';

// LINE rich menu exact pixel dimensions
const LINE_LARGE   = { width: 2500, height: 1686 } as const; // ~3:2 (banner + buttons)
const LINE_COMPACT = { width: 2500, height:  843 } as const; // ~3:1 (buttons-only row)
const LINE_MAX_BYTES = 1_000_000; // 1 MB hard limit enforced by LINE

/**
 * Pick the LINE canvas size that best matches the uploaded image's aspect ratio.
 * - If the image is more landscape than 2.2:1  → compact (2500×843)
 * - Otherwise                                  → large  (2500×1686)
 */
function pickLineSize(w: number, h: number) {
  const ratio = w / h;
  return ratio >= 2.2 ? LINE_COMPACT : LINE_LARGE;
}

/**
 * Resize + compress to JPEG, then back off quality until we're under maxBytes.
 */
async function prepareForLine(
  sharp: typeof import('sharp'),
  input: Buffer,
  target: { width: number; height: number },
): Promise<{ buffer: Buffer; originalSize: number }> {
  const originalSize = input.length;

  // Resize to exact LINE dimensions (cover = crop to fill, no black bars)
  const resized = sharp(input).resize(target.width, target.height, {
    fit: 'cover',
    position: 'centre',
  });

  // Try JPEG at decreasing quality levels until within LINE's 1 MB limit
  const qualities = [90, 80, 70, 60];
  for (const q of qualities) {
    const buffer = await resized.clone().jpeg({ quality: q, progressive: true }).toBuffer();
    if (buffer.length <= LINE_MAX_BYTES) {
      return { buffer, originalSize };
    }
  }

  // Last resort: quality 50
  const buffer = await resized.clone().jpeg({ quality: 50, progressive: true }).toBuffer();
  return { buffer, originalSize };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; menuId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id: channelId, menuId } = await params;

  // Verify ownership
  const rows = await db
    .select({ channelUserId: lineOaChannel.userId })
    .from(lineRichMenu)
    .innerJoin(lineOaChannel, eq(lineRichMenu.channelId, lineOaChannel.id))
    .where(eq(lineRichMenu.id, menuId))
    .limit(1);

  if (!rows[0]) return new Response('Not found', { status: 404 });
  if (rows[0].channelUserId !== session.user.id) return new Response('Forbidden', { status: 403 });

  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  if (!file) return new Response('Missing image field', { status: 400 });

  // Accept common raster formats — we always output JPEG for LINE
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return new Response('Unsupported format. Upload PNG, JPEG, or WebP.', { status: 400 });
  }

  const RAW_MAX = 20 * 1024 * 1024; // 20 MB raw input guard
  if (file.size > RAW_MAX) return new Response('File too large (max 20 MB)', { status: 400 });

  const rawBuffer = Buffer.from(await file.arrayBuffer());

  // Dynamic import — Sharp is server-only
  const sharp = (await import('sharp')).default;

  // Read metadata to detect dimensions
  const meta = await sharp(rawBuffer).metadata();
  const srcW = meta.width ?? 2500;
  const srcH = meta.height ?? 1686;

  const target = pickLineSize(srcW, srcH);

  const { buffer: optimized, originalSize } = await prepareForLine(sharp, rawBuffer, target);

  const savedPct = (((originalSize - optimized.length) / originalSize) * 100).toFixed(0);
  console.log(
    `[rich-menu-upload] ${(originalSize / 1024).toFixed(0)}KB → ${(optimized.length / 1024).toFixed(0)}KB (${savedPct}% saved) → ${target.width}×${target.height}`,
  );

  const key = `rich-menu/${channelId}/${menuId}.jpg`;

  const { url } = await uploadPublicObject({
    key,
    body: optimized,
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=86400',
  });

  // Persist URL and reset to draft (image changed)
  await db
    .update(lineRichMenu)
    .set({ backgroundImageUrl: url, status: 'draft', lineMenuId: null, updatedAt: new Date() })
    .where(eq(lineRichMenu.id, menuId));

  return Response.json({
    url,
    processed: {
      targetSize: `${target.width}×${target.height}`,
      originalKB: Math.round(originalSize / 1024),
      optimizedKB: Math.round(optimized.length / 1024),
      savedPercent: Number(savedPct),
    },
  });
}
