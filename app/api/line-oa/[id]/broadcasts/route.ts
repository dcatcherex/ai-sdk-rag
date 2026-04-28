import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { listBroadcasts, createBroadcast } from '@/features/line-oa/broadcast/service';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  messageText: z.string().max(5000).optional(),
  messageType: z.enum(['text', 'flex']).optional(),
  messagePayload: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: channelId } = await params;
  const broadcasts = await listBroadcasts(channelId, authResult.user.id);
  return NextResponse.json(broadcasts);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: channelId } = await params;
  const body = createSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });

  const broadcast = await createBroadcast(channelId, authResult.user.id, body.data);
  return NextResponse.json(broadcast, { status: 201 });
}
