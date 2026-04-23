import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { stockImage } from '@/db/schema/tools';

export type StockImageItem = { imageUrl: string; thumbnailUrl: string | null };

/**
 * Pull up to `count` random images from the stock pool.
 * Tries styleTag + aspectRatio first; falls back to styleTag-only.
 * Returns an empty array when the pool is empty (caller falls back to real-time only).
 */
export async function getStockImages(
  styleTag: string | undefined,
  aspectRatio: string | undefined,
  count: number,
): Promise<StockImageItem[]> {
  const select = () =>
    db
      .select({ imageUrl: stockImage.imageUrl, thumbnailUrl: stockImage.thumbnailUrl })
      .from(stockImage)
      .orderBy(sql`RANDOM()`)
      .limit(count);

  if (styleTag && aspectRatio) {
    const rows = await select().where(
      and(eq(stockImage.styleTag, styleTag), eq(stockImage.aspectRatio, aspectRatio)),
    );
    if (rows.length > 0) return rows;
  }

  if (styleTag) {
    const rows = await select().where(eq(stockImage.styleTag, styleTag));
    if (rows.length > 0) return rows;
  }

  // Generic fallback — any stock image
  return select();
}

/**
 * Add a newly completed image to the stock pool.
 * Silently skips duplicates (same imageUrl).
 */
export async function addToStockPool(
  styleTag: string | undefined,
  aspectRatio: string | undefined,
  imageUrl: string,
  thumbnailUrl?: string,
): Promise<void> {
  await db
    .insert(stockImage)
    .values({
      id: nanoid(),
      styleTag: styleTag ?? null,
      aspectRatio: aspectRatio ?? null,
      imageUrl,
      thumbnailUrl: thumbnailUrl ?? null,
    })
    .onConflictDoNothing({ target: stockImage.imageUrl });
}

/** Increment usedCount for served stock images (fire-and-forget). */
export function recordStockUsage(imageUrls: string[]): void {
  if (imageUrls.length === 0) return;
  void db
    .update(stockImage)
    .set({ usedCount: sql`${stockImage.usedCount} + 1` })
    .where(sql`${stockImage.imageUrl} = ANY(ARRAY[${sql.join(imageUrls.map(u => sql`${u}`), sql`, `)}])`);
}
