import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getDistributionRecords } from '@/features/distribution/service';

async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
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
