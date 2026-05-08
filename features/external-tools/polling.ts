import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { toolRun } from '@/db/schema/tools';

import { normalizeProviderError } from './errors';
import { normalizeRunResult } from './normalize';
import { createProviderClient } from './provider-client';
import { getProviderByKey } from './registry';
import {
  completeProviderToolRun,
  failProviderToolRun,
  persistProviderArtifacts,
} from './run-lifecycle';
import type { NormalizedRunResult } from './types';

type PendingRunRecord = {
  id: string;
  toolSlug: string;
  status: string;
  outputJson: unknown;
  inputJson: unknown;
};

type StoredOutput = { providerRunId?: string };
type StoredInput = { _provider?: string };

/**
 * Poll the external provider for the current state of a pending run.
 *
 * Returns null when:
 * - The run doesn't exist or belongs to a different user.
 * - The run is not pending (already in a terminal state).
 *
 * When the provider reports a completed or failed state the toolRun record
 * is updated and the normalized result is returned so the caller can surface
 * the outcome immediately without a second DB fetch.
 */
export async function pollExternalRun(
  vajaRunId: string,
  userId: string,
): Promise<NormalizedRunResult | null> {
  const [run] = await db
    .select()
    .from(toolRun)
    .where(and(eq(toolRun.id, vajaRunId), eq(toolRun.userId, userId)))
    .limit(1) as PendingRunRecord[];

  if (!run) return null;
  if (run.status !== 'pending') return null;

  const output = (run.outputJson ?? {}) as StoredOutput;
  const input = (run.inputJson ?? {}) as StoredInput;

  const providerRunId = output.providerRunId;
  const providerKey = input._provider;

  if (!providerRunId || !providerKey) return null;

  const provider = getProviderByKey(providerKey);
  if (!provider) return null;

  const client = createProviderClient(provider.key, provider.baseUrl);

  let response;
  try {
    response = await client.getRunStatus(providerRunId);
  } catch (err) {
    // Provider call failed — don't update the run, let the caller retry
    const providerErr = normalizeProviderError(err);
    return {
      vajaRunId,
      providerRunId,
      status: 'pending',
      title: 'Waiting for provider',
      error: providerErr,
      completedAt: undefined,
    };
  }

  if (response.status === 'pending') {
    return normalizeRunResult(vajaRunId, response);
  }

  // Terminal: persist and return
  await completeProviderToolRun(vajaRunId, response);
  if (response.artifacts?.length) {
    await persistProviderArtifacts(vajaRunId, response.artifacts);
  }

  return normalizeRunResult(vajaRunId, response);
}
