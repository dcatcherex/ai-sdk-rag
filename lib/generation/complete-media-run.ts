import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';

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
}
