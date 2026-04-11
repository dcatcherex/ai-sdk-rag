import 'server-only';

import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { workspaceAiRun } from '@/db/schema';
import type { WorkspaceImageAssistRequestInput, WorkspaceTextAssistRequestInput } from './schema';

type StartWorkspaceAiRunInput = {
  userId: string;
  kind: string;
  route: 'text' | 'image';
  entityType: string;
  entityId?: string;
  inputJson: Record<string, unknown>;
};

export async function startWorkspaceAiRun(input: StartWorkspaceAiRunInput): Promise<string> {
  const id = nanoid();
  await db.insert(workspaceAiRun).values({
    id,
    userId: input.userId,
    kind: input.kind,
    route: input.route,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    status: 'pending',
    inputJson: input.inputJson,
  });
  return id;
}

export async function completeWorkspaceAiRun(
  runId: string,
  payload: {
    modelId?: string;
    outputJson?: Record<string, unknown>;
    status?: 'success' | 'error';
    errorMessage?: string;
  },
) {
  await db.update(workspaceAiRun)
    .set({
      modelId: payload.modelId ?? null,
      outputJson: payload.outputJson,
      status: payload.status ?? 'success',
      errorMessage: payload.errorMessage ?? null,
      completedAt: new Date(),
    })
    .where(eq(workspaceAiRun.id, runId));
}

export function buildWorkspaceAiAuditInput(
  input: WorkspaceTextAssistRequestInput | WorkspaceImageAssistRequestInput,
): Record<string, unknown> {
  return {
    kind: input.kind,
    targetLocale: 'targetLocale' in input ? input.targetLocale : undefined,
    tone: 'tone' in input ? input.tone : undefined,
    instruction: input.instruction,
    context: input.context,
  };
}
