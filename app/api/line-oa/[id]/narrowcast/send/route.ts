import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { sendNarrowcast } from '@/features/line-oa/broadcast/service';

const narrowcastSchema = z.object({
  audienceId: z.string().min(1),
  messageText: z.string().min(1).max(5000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: channelId } = await params;
  const body = narrowcastSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });

  await sendNarrowcast(channelId, authResult.user.id, body.data);
  return NextResponse.json({ ok: true });
}
