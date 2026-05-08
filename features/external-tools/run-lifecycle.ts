import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { toolArtifact, toolRun } from '@/db/schema/tools';

import type { ProviderArtifact, ProviderResponseEnvelope } from './types';
export { normalizeRunResult } from './normalize';

export type CreateRunInput = {
  userId: string;
  toolSlug: string;
  source: string;
  threadId?: string;
  agentId?: string;
  input: Record<string, unknown>;
  providerKey: string;
  idempotencyKey: string;
};

export async function createProviderToolRun(opts: CreateRunInput): Promise<string> {
  const id = nanoid();
  await db.insert(toolRun).values({
    id,
    toolSlug: opts.toolSlug,
    toolKind: 'external',
    userId: opts.userId,
    threadId: opts.threadId,
    agentId: opts.agentId,
    source: opts.source,
    status: 'pending',
    inputJson: {
      ...opts.input,
      _provider: opts.providerKey,
      _idempotencyKey: opts.idempotencyKey,
    },
  });
  return id;
}

export async function completeProviderToolRun(
  vajaRunId: string,
  response: ProviderResponseEnvelope,
): Promise<void> {
  await db
    .update(toolRun)
    .set({
      status: response.status === 'success' ? 'completed' : response.status,
      outputJson: {
        providerRunId: response.providerRunId,
        title: response.title,
        summary: response.summary,
        data: response.data,
        artifacts: response.artifacts,
        usage: response.usage,
        error: response.error,
        completedAt: response.completedAt,
      },
      errorMessage: response.error?.message ?? null,
      completedAt: response.completedAt ? new Date(response.completedAt) : new Date(),
    })
    .where(eq(toolRun.id, vajaRunId));
}

export async function failProviderToolRun(vajaRunId: string, errorMessage: string): Promise<void> {
  await db
    .update(toolRun)
    .set({
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
    })
    .where(eq(toolRun.id, vajaRunId));
}

export async function markProviderRunPending(
  vajaRunId: string,
  providerRunId: string,
): Promise<void> {
  await db
    .update(toolRun)
    .set({
      outputJson: { providerRunId, status: 'pending' },
    })
    .where(eq(toolRun.id, vajaRunId));
}

export async function persistProviderArtifacts(
  vajaRunId: string,
  artifacts: ProviderArtifact[],
): Promise<void> {
  if (artifacts.length === 0) return;

  const rows = artifacts.map((a) => ({
    id: nanoid(),
    toolRunId: vajaRunId,
    kind: a.kind,
    format: a.format,
    storageUrl: a.url,
    payloadJson: { label: a.label, artifactId: a.artifactId } as Record<string, unknown>,
  }));

  await db.insert(toolArtifact).values(rows);
}
