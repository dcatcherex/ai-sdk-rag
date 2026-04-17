import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth-server";
import { getContentMetrics } from '@/features/analytics/service';

async function getUserId(): Promise<string | null>  {
  const user = await getCurrentUser();
  return user?.id ?? null;
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
