import { and, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { toolRun } from '@/db/schema/tools';

import { providerResponseEnvelopeSchema } from './schema';
import {
  completeProviderToolRun,
  failProviderToolRun,
  persistProviderArtifacts,
} from './run-lifecycle';

export { verifyHmacSignature } from './callback-crypto';
import { verifyHmacSignature } from './callback-crypto';

// ── Signature verification ─────────────────────────────────────────────────────

/**
 * Look up the callback secret for a provider from env and verify the signature.
 * If no secret is configured (dev/test), the callback is accepted without verification.
 */
export function verifyCallbackSignature(
  body: string,
  signature: string | null,
  providerKey: string,
): boolean {
  const envKey = `PROVIDER_SECRET_${providerKey.toUpperCase().replace(/-/g, '_')}`;
  const secret = process.env[envKey];

  if (!secret) return true; // no secret configured — dev mode
  if (!signature) return false;

  return verifyHmacSignature(body, signature, secret);
}

// ── Run lookup ─────────────────────────────────────────────────────────────────

type RunRecord = {
  id: string;
  userId: string;
  toolSlug: string;
  status: string;
  outputJson: unknown;
};

/**
 * Find a pending toolRun by its provider run ID.
 * Also validates that the record belongs to the expected provider key to
 * prevent cross-provider spoofing.
 */
export async function findRunByProviderRunId(
  providerRunId: string,
  providerKey: string,
): Promise<RunRecord | null> {
  const rows = await db
    .select({
      id: toolRun.id,
      userId: toolRun.userId,
      toolSlug: toolRun.toolSlug,
      status: toolRun.status,
      outputJson: toolRun.outputJson,
    })
    .from(toolRun)
    .where(
      and(
        sql`${toolRun.outputJson}->>'providerRunId' = ${providerRunId}`,
        sql`${toolRun.inputJson}->>'_provider' = ${providerKey}`,
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

// ── Callback processing ────────────────────────────────────────────────────────

export type CallbackResult = {
  vajaRunId: string;
  status: string;
  skipped: boolean;
};

/**
 * Process an authenticated provider callback.
 *
 * - Validates the HMAC signature.
 * - Parses the provider response envelope.
 * - Finds the corresponding toolRun.
 * - Skips silently if the run is already terminal (idempotent).
 * - Updates the run and persists artifacts.
 */
export async function processProviderCallback(
  providerKey: string,
  rawBody: string,
  signature: string | null,
): Promise<CallbackResult> {
  if (!verifyCallbackSignature(rawBody, signature, providerKey)) {
    throw Object.assign(new Error('Invalid callback signature'), { code: 'INVALID_SIGNATURE' });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw Object.assign(new Error('Callback body is not valid JSON'), { code: 'INVALID_JSON' });
  }

  const parsed = providerResponseEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw Object.assign(new Error(`Callback schema invalid: ${parsed.error.message}`), {
      code: 'SCHEMA_ERROR',
    });
  }

  const response = parsed.data;
  const run = await findRunByProviderRunId(response.providerRunId, providerKey);

  if (!run) {
    // Unknown run — log and return without error so the provider doesn't retry
    return { vajaRunId: '', status: 'unknown', skipped: true };
  }

  // Idempotency: skip if the run is already in a terminal state
  if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
    return { vajaRunId: run.id, status: run.status, skipped: true };
  }

  if (response.status === 'pending') {
    // Still processing — nothing to update
    return { vajaRunId: run.id, status: 'pending', skipped: true };
  }

  if (response.status === 'failed' || response.status === 'cancelled') {
    const message = response.error?.message ?? `Provider run ${response.status}`;
    await failProviderToolRun(run.id, message);
    return { vajaRunId: run.id, status: response.status, skipped: false };
  }

  // Success path: update run + persist artifacts
  await completeProviderToolRun(run.id, response);
  if (response.artifacts?.length) {
    await persistProviderArtifacts(run.id, response.artifacts);
  }

  return { vajaRunId: run.id, status: 'completed', skipped: false };
}
