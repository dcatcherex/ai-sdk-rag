import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendBroadcast } from '@/features/line-oa/broadcast/service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; broadcastId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { broadcastId } = await params;

  try {
    const result = await sendBroadcast(broadcastId, session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send broadcast';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
