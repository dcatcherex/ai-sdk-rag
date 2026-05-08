import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { toolArtifact, toolRun } from '@/db/schema/tools';

export { normalizeToolRunRecord, type ExternalRunStatus } from './status-normalize';
import { normalizeToolRunRecord } from './status-normalize';
import type { ExternalRunStatus } from './status-normalize';

/**
 * Fetch the status of an external tool run for a specific user.
 * Returns null when the run doesn't exist or belongs to a different user.
 */
export async function getExternalRunStatus(
  vajaRunId: string,
  userId: string,
): Promise<ExternalRunStatus | null> {
  const [run] = await db
    .select()
    .from(toolRun)
    .where(and(eq(toolRun.id, vajaRunId), eq(toolRun.userId, userId)))
    .limit(1);

  if (!run) return null;

  const artifacts = await db
    .select()
    .from(toolArtifact)
    .where(eq(toolArtifact.toolRunId, vajaRunId));

  return normalizeToolRunRecord(run, artifacts);
}
