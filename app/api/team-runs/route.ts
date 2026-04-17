import { NextResponse } from 'next/server';

import { requireUser } from "@/lib/auth-server";
import { listTeamRuns, getTeamRunWithSteps } from '@/features/agent-teams/server/queries';

// ── GET /api/team-runs?teamId=xxx[&runId=yyy] ─────────────────────────────────
export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const runId = searchParams.get('runId');

  if (!teamId) {
    return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
  }

  // Single run with steps
  if (runId) {
    const run = await getTeamRunWithSteps(runId, authResult.user.id);
    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ run });
  }

  // List runs for a team
  const runs = await listTeamRuns(teamId, authResult.user.id);
  return NextResponse.json({ runs });
}
