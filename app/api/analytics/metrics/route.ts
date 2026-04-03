import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { trackMetric, getUserRecentMetrics } from '@/features/analytics/service';
import { z } from 'zod';

const trackSchema = z.object({
  contentPieceId: z.string().min(1),
  platform: z.enum(['linkedin', 'twitter', 'email', 'blog', 'instagram', 'facebook', 'other']),
  views: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  impressions: z.number().int().min(0).optional(),
  engagement: z.number().int().min(0).optional(),
  conversions: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  measuredAt: z.string().optional(),
});

async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function GET(_req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const metrics = await getUserRecentMetrics(userId);
  return NextResponse.json(metrics);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const result = trackSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const metric = await trackMetric(userId, result.data);
  return NextResponse.json(metric, { status: 201 });
}
