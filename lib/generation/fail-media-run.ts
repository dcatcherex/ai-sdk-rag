import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';

/**
 * Mark a media toolRun as failed and record the error message.
 * Used by the KIE callback route and the polling status route.
 */
export async function failMediaRun(params: {
  generationId: string;
  errorMessage: string;
  existingOutputJson?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const { generationId, errorMessage, existingOutputJson = {}, extra = {} } = params;

  await db.update(toolRun)
    .set({
      status: 'error',
      errorMessage,
      outputJson: {
        ...existingOutputJson,
        ...extra,
      },
    })
    .where(eq(toolRun.id, generationId));
}
