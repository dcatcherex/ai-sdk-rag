import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { listTeamRuns, getTeamRunWithSteps } from '@/features/agent-teams/server/queries';

// ── GET /api/team-runs?teamId=xxx[&runId=yyy] ─────────────────────────────────
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const runId = searchParams.get('runId');

  if (!teamId) {
    return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
  }

  // Single run with steps
  if (runId) {
    const run = await getTeamRunWithSteps(runId, session.user.id);
    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ run });
  }

  // List runs for a team
  const runs = await listTeamRuns(teamId, session.user.id);
  return NextResponse.json({ runs });
}
