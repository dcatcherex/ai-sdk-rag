import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * POST /api/platform-agent/onboard
 * Legacy onboarding path is disabled in favor of admin-configured starter templates.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  void req;
  return NextResponse.json(
    {
      error: 'Legacy onboarding is disabled. Configure a new-user starter template in Platform Settings instead.',
    },
    { status: 410 },
  );
}
