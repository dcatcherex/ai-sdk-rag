import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth-server";
import { createAbVariant } from '@/features/analytics/service';
import { z } from 'zod';

const createSchema = z.object({
  contentPieceId: z.string().min(1),
  variantLabel: z.string().min(1),
  body: z.string().min(1),
});

async function getUserId(): Promise<string | null>  {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const result = createSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const variant = await createAbVariant(userId, result.data);
  return NextResponse.json(variant, { status: 201 });
}
