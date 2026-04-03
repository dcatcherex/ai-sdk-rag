import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { deleteMetric } from '@/features/analytics/service';

async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ contentPieceId: string; metricId: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { metricId } = await params;
  await deleteMetric(userId, metricId);
  return new NextResponse(null, { status: 204 });
}
