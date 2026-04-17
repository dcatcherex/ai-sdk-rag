import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { updateBroadcast, deleteBroadcast } from '@/features/line-oa/broadcast/service';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  messageText: z.string().min(1).max(5000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; broadcastId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { broadcastId } = await params;
  const body = updateSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });

  await updateBroadcast(broadcastId, authResult.user.id, body.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; broadcastId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { broadcastId } = await params;
  await deleteBroadcast(broadcastId, authResult.user.id);
  return NextResponse.json({ ok: true });
}
