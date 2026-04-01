import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getTeamRunWithSteps } from '@/features/agent-teams/server/queries';

type Params = { params: Promise<{ runId: string }> };

// ── GET /api/team-runs/[runId] — run with all steps (for history/audit) ───────
export async function GET(_req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { runId } = await params;
  const run = await getTeamRunWithSteps(runId, session.user.id);

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ run });
}
