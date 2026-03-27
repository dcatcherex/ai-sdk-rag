import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { listBroadcasts, createBroadcast } from '@/features/line-oa/broadcast/service';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  messageText: z.string().min(1).max(5000),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: channelId } = await params;
  const broadcasts = await listBroadcasts(channelId, session.user.id);
  return NextResponse.json(broadcasts);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: channelId } = await params;
  const body = createSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });

  const broadcast = await createBroadcast(channelId, session.user.id, body.data);
  return NextResponse.json(broadcast, { status: 201 });
}
