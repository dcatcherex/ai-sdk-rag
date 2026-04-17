import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { sendBroadcast } from '@/features/line-oa/broadcast/service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; broadcastId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { broadcastId } = await params;

  try {
    const result = await sendBroadcast(broadcastId, authResult.user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send broadcast';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
