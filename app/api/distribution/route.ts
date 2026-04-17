import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth-server";
import { getDistributionRecords } from '@/features/distribution/service';

async function getUserId(): Promise<string | null>  {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const contentPieceId = searchParams.get('contentPieceId') ?? undefined;
  const channel = searchParams.get('channel') ?? undefined;

  const records = await getDistributionRecords(userId, { contentPieceId, channel });
  return NextResponse.json(records);
}
