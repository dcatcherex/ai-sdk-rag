import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { refundGenerationCredits } from '@/lib/api/creditGate';
import { enforceCredits, enforceRateLimit } from '@/lib/api/routeGuards';
import { buildWorkspaceAiAuditInput, completeWorkspaceAiRun, startWorkspaceAiRun } from '@/features/workspace-ai/audit';
import { workspaceImageAssistRequestSchema } from '@/features/workspace-ai/schema';
import { resolveWorkspaceImageAssistCost, runWorkspaceImageAssist } from '@/features/workspace-ai/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const rateLimitResponse = await enforceRateLimit(authResult.user.id);
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
  const creditResponse = await enforceCredits(authResult.user.id, modelIdForCredits, resolvedCost);
  if (creditResponse) return creditResponse;

  const runId = await startWorkspaceAiRun({
    userId: authResult.user.id,
    kind: parsed.data.kind,
    route: 'image',
    entityType: parsed.data.context.entityType,
    entityId: parsed.data.context.entityId,
    inputJson: buildWorkspaceAiAuditInput(parsed.data),
  });

  try {
    const result = await runWorkspaceImageAssist(parsed.data, authResult.user.id);
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
    await refundGenerationCredits(authResult.user.id, modelIdForCredits, resolvedCost).catch(() => {});
    console.error('Workspace AI image assist failed', error);
    await completeWorkspaceAiRun(runId, {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
