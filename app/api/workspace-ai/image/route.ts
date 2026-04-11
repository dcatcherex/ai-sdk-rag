import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { refundGenerationCredits } from '@/lib/api/creditGate';
import { enforceCredits, enforceRateLimit } from '@/lib/api/routeGuards';
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

  try {
    const result = await runWorkspaceImageAssist(parsed.data, session.user.id);
    return NextResponse.json({ async: true, status: 'processing', ...result });
  } catch (error) {
    await refundGenerationCredits(session.user.id, modelIdForCredits, resolvedCost).catch(() => {});
    console.error('Workspace AI image assist failed', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
