import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";

/**
 * POST /api/platform-agent/onboard
 * Legacy onboarding path is disabled in favor of admin-configured starter templates.
 */
export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  void req;
  return NextResponse.json(
    {
      error: 'Legacy onboarding is disabled. Configure a new-user starter template in Platform Settings instead.',
    },
    { status: 410 },
  );
}
