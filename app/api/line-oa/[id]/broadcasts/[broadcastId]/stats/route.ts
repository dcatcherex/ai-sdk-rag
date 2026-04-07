import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBroadcastStats } from '@/features/line-oa/broadcast/service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; broadcastId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { broadcastId } = await params;
  const stats = await getBroadcastStats(broadcastId, session.user.id);
  if (!stats) return NextResponse.json({ error: 'Stats not available' }, { status: 404 });
  return NextResponse.json(stats);
}
