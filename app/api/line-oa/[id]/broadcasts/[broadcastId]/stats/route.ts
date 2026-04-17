import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { getBroadcastStats } from '@/features/line-oa/broadcast/service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; broadcastId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { broadcastId } = await params;
  const stats = await getBroadcastStats(broadcastId, authResult.user.id);
  if (!stats) return NextResponse.json({ error: 'Stats not available' }, { status: 404 });
  return NextResponse.json(stats);
}
