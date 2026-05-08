import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth-server';
import { pollExternalRun } from '@/features/external-tools/polling';
import { getExternalRunStatus } from '@/features/external-tools/status';

/**
 * GET /api/external-tools/runs/[runId]
 *
 * User-scoped status endpoint for external tool runs.
 * Returns the current state of the run from the Vaja DB.
 *
 * Query params:
 *   poll=true  — also ask the provider for the latest state before responding.
 *                Use this for UI polling when the run is still pending.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = await params;
  const shouldPoll = req.nextUrl.searchParams.get('poll') === 'true';

  // Optionally poll the provider for fresh state on pending runs
  if (shouldPoll) {
    const polled = await pollExternalRun(runId, user.id);
    if (polled === null) {
      // Run not found, wrong user, or not pending — fall through to DB read
    } else if (polled.status !== 'pending') {
      // Provider returned a terminal state — return it directly
      return NextResponse.json({ run: polled, polled: true });
    }
  }

  const status = await getExternalRunStatus(runId, user.id);
  if (!status) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ run: status, polled: false });
}
