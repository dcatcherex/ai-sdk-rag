import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { refundGenerationCredits } from '@/lib/api/creditGate';
import { enforceCredits, enforceRateLimit } from '@/lib/api/routeGuards';
import { buildWorkspaceAiAuditInput, completeWorkspaceAiRun, startWorkspaceAiRun } from '@/features/workspace-ai/audit';
import { workspaceImageAssistRequestSchema } from '@/features/workspace-ai/schema';
import { resolveWorkspaceImageAssistCost, runWorkspaceImageAssist } from '@/features/workspace-ai/service';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimitResponse = await enforceRateLimit(session.user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = workspaceImageAssistRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const resolvedCost = resolveWorkspaceImageAssistCost(parsed.data);
  const modelIdForCredits = parsed.data.modelId ?? 'nano-banana-2';
  const creditResponse = await enforceCredits(session.user.id, modelIdForCredits, resolvedCost);
  if (creditResponse) return creditResponse;

  const runId = await startWorkspaceAiRun({
    userId: session.user.id,
    kind: parsed.data.kind,
    route: 'image',
    entityType: parsed.data.context.entityType,
    entityId: parsed.data.context.entityId,
    inputJson: buildWorkspaceAiAuditInput(parsed.data),
  });

  try {
    const result = await runWorkspaceImageAssist(parsed.data, session.user.id);
    await completeWorkspaceAiRun(runId, {
      modelId: result.modelId,
      outputJson: {
        prompt: result.prompt,
        taskId: result.taskId,
        generationId: result.generationId,
      },
      status: 'success',
    });
    return NextResponse.json({ async: true, status: 'processing', ...result });
  } catch (error) {
    await refundGenerationCredits(session.user.id, modelIdForCredits, resolvedCost).catch(() => {});
    console.error('Workspace AI image assist failed', error);
    await completeWorkspaceAiRun(runId, {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
