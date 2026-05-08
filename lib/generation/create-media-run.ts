import 'server-only';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';

/**
 * Insert a pending toolRun record for any media generation job.
 * All four media services (image, video, audio, speech) use this.
 */
export async function createMediaRun(params: {
  toolSlug: string;
  userId: string;
  inputJson: Record<string, unknown>;
  threadId?: string | null;
  source?: string;
}): Promise<{ generationId: string }> {
  // If the caller has already obtained a KIE task ID, store it as providerRunId
  // in outputJson so Phase 3 status/polling infrastructure can find this run.
  // The completeMediaRun helper spreads existingOutputJson, so providerRunId is
  // preserved in the final outputJson when the job completes.
  const kieTaskId = typeof params.inputJson.kieTaskId === 'string'
    ? params.inputJson.kieTaskId
    : undefined;

  const [record] = await db.insert(toolRun).values({
    id: nanoid(),
    toolSlug: params.toolSlug,
    userId: params.userId,
    threadId: params.threadId ?? null,
    source: params.source ?? 'api',
    status: 'pending',
    inputJson: params.inputJson,
    outputJson: kieTaskId ? { providerRunId: kieTaskId } : undefined,
  }).returning();

  return { generationId: record!.id };
}
