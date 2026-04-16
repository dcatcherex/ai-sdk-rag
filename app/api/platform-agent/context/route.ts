import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWorkspaceContext } from '@/features/platform-agent/service';

/**
 * GET /api/platform-agent/context
 * Returns a workspace snapshot for injection into the platform agent system prompt.
 * Called at runtime — not by end users directly.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getWorkspaceContext(session.user.id);
  return NextResponse.json(ctx);
}
