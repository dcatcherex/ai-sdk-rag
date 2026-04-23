import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { stockImage } from '@/db/schema/tools';
import { nanoid } from 'nanoid';

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(req.url);
  const styleTag = searchParams.get('styleTag') ?? undefined;
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 200);
  const offset = Number(searchParams.get('offset') ?? 0);

  const query = db
    .select({
      id: stockImage.id,
      styleTag: stockImage.styleTag,
      aspectRatio: stockImage.aspectRatio,
      imageUrl: stockImage.imageUrl,
      thumbnailUrl: stockImage.thumbnailUrl,
      usedCount: stockImage.usedCount,
      createdAt: stockImage.createdAt,
    })
    .from(stockImage)
    .orderBy(sql`${stockImage.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  const rows = styleTag
    ? await query.where(eq(stockImage.styleTag, styleTag))
    : await query;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(stockImage);

  const stats = await db
    .select({
      styleTag: stockImage.styleTag,
      count: sql<number>`count(*)::int`,
    })
    .from(stockImage)
    .groupBy(stockImage.styleTag);

  return Response.json({ images: rows, total, stats });
}

const addSchema = z.object({
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  styleTag: z.string().optional(),
  aspectRatio: z.string().optional(),
});

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json();
  const result = addSchema.safeParse(body);
  if (!result.success) return Response.json({ error: 'Invalid request' }, { status: 400 });

  const { imageUrl, thumbnailUrl, styleTag, aspectRatio } = result.data;

  await db
    .insert(stockImage)
    .values({ id: nanoid(), imageUrl, thumbnailUrl: thumbnailUrl ?? null, styleTag: styleTag ?? null, aspectRatio: aspectRatio ?? null })
    .onConflictDoNothing({ target: stockImage.imageUrl });

  return Response.json({ ok: true });
}
