import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import { addToStockPool } from '@/features/image/stock-service';

/**
 * Mark a media toolRun as successfully completed and persist output URLs.
 * Used by the KIE callback route and the polling status route.
 */
export async function completeMediaRun(params: {
  generationId: string;
  outputUrl?: string;
  outputUrls?: string[];
  latency?: number;
  existingOutputJson?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const {
    generationId,
    outputUrl,
    outputUrls,
    latency,
    existingOutputJson = {},
    extra = {},
  } = params;

  const resolvedUrls = outputUrls?.length ? outputUrls : outputUrl ? [outputUrl] : [];

  await db.update(toolRun)
    .set({
      status: 'success',
      completedAt: new Date(),
      outputJson: {
        ...existingOutputJson,
        output: outputUrl ?? resolvedUrls[0],
        outputs: resolvedUrls,
        ...(latency !== undefined ? { latency } : {}),
        ...extra,
      },
    })
    .where(eq(toolRun.id, generationId));

  // Auto-populate stock pool for image generations (fire-and-forget)
  if (resolvedUrls.length > 0) {
    const run = await db
      .select({ toolSlug: toolRun.toolSlug, inputJson: toolRun.inputJson })
      .from(toolRun)
      .where(eq(toolRun.id, generationId))
      .limit(1);
    const row = run[0];
    if (row?.toolSlug === 'image') {
      const input = row.inputJson as Record<string, unknown>;
      const styleTag = typeof input.taskHint === 'string' ? input.taskHint : undefined;
      const aspectRatio = typeof input.aspectRatio === 'string' ? input.aspectRatio : undefined;
      void Promise.all(
        resolvedUrls.map(url => addToStockPool(styleTag, aspectRatio, url)),
      );
    }
  }
}
