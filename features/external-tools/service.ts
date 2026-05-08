import { nanoid } from 'nanoid';

import { normalizeProviderError } from './errors';
import { normalizeRunResult, toToolExecutionResult } from './normalize';
import { createProviderClient } from './provider-client';
import { getProviderForTool } from './registry';
import {
  completeProviderToolRun,
  createProviderToolRun,
  failProviderToolRun,
  markProviderRunPending,
  persistProviderArtifacts,
} from './run-lifecycle';
import type { NormalizedRunResult, ProviderRunOptions } from './types';

/**
 * Execute a tool through its registered external provider.
 * Returns a NormalizedRunResult suitable for mapping to ToolExecutionResult.
 *
 * For sync providers the result is complete on return.
 * For async providers the status will be 'pending' and a providerRunId is recorded
 * so the callback route or polling can finalize later.
 */
export async function runExternalTool(opts: ProviderRunOptions): Promise<NormalizedRunResult> {
  const provider = getProviderForTool(opts.toolSlug);
  if (!provider) {
    throw new Error(`No external provider registered for tool "${opts.toolSlug}"`);
  }

  const idempotencyKey = opts.idempotencyKey ?? nanoid();
  const vajaRunId = await createProviderToolRun({
    userId: opts.userId,
    toolSlug: opts.toolSlug,
    source: opts.source,
    threadId: opts.threadId,
    input: opts.input,
    providerKey: provider.key,
    idempotencyKey,
  });

  const client = createProviderClient(
    provider.key,
    provider.baseUrl,
    provider.providerMetadata.supportsSync ? 30_000 : 120_000,
  );

  const envelope = client.buildEnvelope({
    idempotencyKey,
    vajaRunId,
    toolSlug: opts.toolSlug,
    source: opts.source,
    userRef: opts.userId,
    threadRef: opts.threadId,
    input: opts.input,
    context: opts.context,
    callbackUrl: opts.callbackUrl,
  });

  try {
    const useAsync =
      provider.providerMetadata.supportsAsync && !provider.providerMetadata.supportsSync;
    const response = useAsync
      ? await client.startAsync(opts.toolSlug, envelope)
      : await client.runSync(opts.toolSlug, envelope);

    if (response.status === 'pending') {
      await markProviderRunPending(vajaRunId, response.providerRunId);
    } else {
      await completeProviderToolRun(vajaRunId, response);
      if (response.artifacts?.length) {
        await persistProviderArtifacts(vajaRunId, response.artifacts);
      }
    }

    return normalizeRunResult(vajaRunId, response);
  } catch (err) {
    const providerErr = normalizeProviderError(err);
    await failProviderToolRun(vajaRunId, providerErr.message);
    throw err;
  }
}

export { toToolExecutionResult } from './normalize';

/**
 * Check provider health. Returns true if healthy.
 */
export async function checkProviderHealth(toolSlug: string): Promise<boolean> {
  const provider = getProviderForTool(toolSlug);
  if (!provider || !provider.providerMetadata.supportsHealthCheck) return false;

  const client = createProviderClient(provider.key, provider.baseUrl);
  return client.checkHealth();
}
