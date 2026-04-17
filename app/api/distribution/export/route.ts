import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth-server";
import { exportContentPiece } from '@/features/distribution/service';
import { z } from 'zod';

const exportSchema = z.object({
  contentPieceId: z.string().min(1),
  format: z.enum(['markdown', 'html', 'plain']),
});

async function getUserId(): Promise<string | null>  {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const result = exportSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const exported = await exportContentPiece(userId, result.data);
  return NextResponse.json(exported);
}
