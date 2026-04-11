import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { workspaceTextAssistRequestSchema } from '@/features/workspace-ai/schema';
import { buildWorkspaceAiAuditInput, completeWorkspaceAiRun, startWorkspaceAiRun } from '@/features/workspace-ai/audit';
import { runWorkspaceTextAssist } from '@/features/workspace-ai/service';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = workspaceTextAssistRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const runId = await startWorkspaceAiRun({
    userId: session.user.id,
    kind: parsed.data.kind,
    route: 'text',
    entityType: parsed.data.context.entityType,
    entityId: parsed.data.context.entityId,
    inputJson: buildWorkspaceAiAuditInput(parsed.data),
  });

  try {
    const result = await runWorkspaceTextAssist(parsed.data);
    await completeWorkspaceAiRun(runId, {
      modelId: result.modelId,
      outputJson: { suggestions: result.suggestions },
      status: 'success',
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Workspace AI text assist failed', error);
    await completeWorkspaceAiRun(runId, {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
