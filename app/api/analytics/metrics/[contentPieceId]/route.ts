import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getContentMetrics } from '@/features/analytics/service';

async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contentPieceId: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { contentPieceId } = await params;
  const metrics = await getContentMetrics(userId, contentPieceId);
  return NextResponse.json(metrics);
}
