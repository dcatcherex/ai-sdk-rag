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
  const [record] = await db.insert(toolRun).values({
    id: nanoid(),
    toolSlug: params.toolSlug,
    userId: params.userId,
    threadId: params.threadId ?? null,
    source: params.source ?? 'api',
    status: 'pending',
    inputJson: params.inputJson,
  }).returning();

  return { generationId: record!.id };
}
