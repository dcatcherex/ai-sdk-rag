import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { runOnboardingPlan } from '@/features/platform-agent/service';

const requestSchema = z.object({
  professionHint: z.string().min(1).max(200),
  language: z.enum(['th', 'en']).optional().default('th'),
});

/**
 * POST /api/platform-agent/onboard
 * Triggers first-time onboarding: creates agent + skills based on profession.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const plan = await runOnboardingPlan(session.user.id, body.data.professionHint);
  return NextResponse.json(plan);
}
