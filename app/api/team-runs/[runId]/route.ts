import { NextResponse } from 'next/server';

import { requireUser } from "@/lib/auth-server";
import { getTeamRunWithSteps } from '@/features/agent-teams/server/queries';

type Params = { params: Promise<{ runId: string }> };

// ── GET /api/team-runs/[runId] — run with all steps (for history/audit) ───────
export async function GET(_req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { runId } = await params;
  const run = await getTeamRunWithSteps(runId, authResult.user.id);

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ run });
}
