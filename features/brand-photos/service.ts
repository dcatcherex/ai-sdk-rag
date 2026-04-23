import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { brandPhoto } from '@/db/schema/tools';
import type { GetBrandPhotosInput, GetBrandPhotosOutput, BrandPhotoItem } from './schema';
import type { BrandPhotoContext } from './types';
import { buildBrandImageContext } from '@/features/brands/service';

function buildWhere(ctx: BrandPhotoContext) {
  if (ctx.brandId) return eq(brandPhoto.brandId, ctx.brandId);
  if (ctx.userId) return eq(brandPhoto.userId, ctx.userId);
  if (ctx.lineUserId && ctx.channelId) {
    return and(
      eq(brandPhoto.lineUserId, ctx.lineUserId),
      eq(brandPhoto.channelId, ctx.channelId),
    );
  }
  if (ctx.lineUserId) {
    return and(eq(brandPhoto.lineUserId, ctx.lineUserId), isNull(brandPhoto.channelId));
  }
  throw new Error('BrandPhotoContext requires brandId, userId, or lineUserId');
}

/**
 * Weighted random pick — least-used photos have the highest probability.
 * Weight for each photo = (maxUsage - usageCount + 1).
 * This ensures usage counts converge over time without being purely deterministic.
 */
function weightedPick<T extends { usageCount: number }>(pool: T[], limit: number): T[] {
  if (pool.length <= limit) return [...pool];

  const maxUsage = Math.max(...pool.map((p) => p.usageCount));
  const weighted = pool.map((p) => ({ item: p, weight: maxUsage - p.usageCount + 1 }));
  const picked: T[] = [];
  const remaining = [...weighted];

  while (picked.length < limit && remaining.length > 0) {
    const total = remaining.reduce((s, p) => s + p.weight, 0);
    let rand = Math.random() * total;
    let chosen = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      rand -= remaining[i].weight;
      if (rand <= 0) { chosen = i; break; }
    }
    picked.push(remaining[chosen].item);
    remaining.splice(chosen, 1);
  }

  return picked;
}

export async function runGetBrandPhotos(
  input: GetBrandPhotosInput,
  ctx: BrandPhotoContext,
): Promise<GetBrandPhotosOutput> {
  const rows = await db
    .select()
    .from(brandPhoto)
    .where(buildWhere(ctx));

  // Filter by tags if provided
  const filtered = input.tags?.length
    ? rows.filter((r) => input.tags!.some((t) => r.tags.includes(t)))
    : rows;

  const limit = input.limit ?? 1;
  const picked = weightedPick(filtered, limit);

  // Increment usageCount for all picked photos
  if (picked.length > 0) {
    await db
      .update(brandPhoto)
      .set({ usageCount: sql`${brandPhoto.usageCount} + 1`, lastUsedAt: new Date() })
      .where(inArray(brandPhoto.id, picked.map((p) => p.id)));
  }

  // Collect all distinct tags
  const allTags = [...new Set(rows.flatMap((r) => r.tags))].sort();
  const logoUrl =
    input.includeLogo && ctx.brandId
      ? (await buildBrandImageContext(ctx.brandId)).logoUrl
      : null;
  const photoUrls = picked.map((p) => p.url);
  const imageUrls = logoUrl ? [...photoUrls, logoUrl] : photoUrls;

  return {
    photos: picked.map((p): BrandPhotoItem => ({
      id: p.id,
      url: p.url,
      filename: p.filename ?? null,
      tags: p.tags,
      usageCount: p.usageCount,
    })),
    totalAvailable: filtered.length,
    tags: allTags,
    logoUrl,
    imageUrls,
  };
}

// ── API-layer helpers (used by upload/delete routes) ─────────────────────────

export async function listBrandPhotos(ctx: BrandPhotoContext) {
  return db.select().from(brandPhoto).where(buildWhere(ctx)).orderBy(brandPhoto.createdAt);
}

export async function saveBrandPhoto(
  ctx: BrandPhotoContext,
  data: { url: string; r2Key: string; filename?: string; tags: string[] },
) {
  const row = {
    id: nanoid(),
    userId: ctx.userId ?? null,
    brandId: ctx.brandId ?? null,
    lineUserId: ctx.lineUserId ?? null,
    channelId: ctx.channelId ?? null,
    url: data.url,
    r2Key: data.r2Key,
    filename: data.filename ?? null,
    tags: data.tags,
  };
  await db.insert(brandPhoto).values(row);
  return row;
}

export async function deleteBrandPhoto(id: string, ctx: BrandPhotoContext) {
  const rows = await db
    .select({ r2Key: brandPhoto.r2Key })
    .from(brandPhoto)
    .where(and(eq(brandPhoto.id, id), buildWhere(ctx)))
    .limit(1);

  if (rows.length === 0) return null;
  await db.delete(brandPhoto).where(eq(brandPhoto.id, id));
  return rows[0]!.r2Key;
}
