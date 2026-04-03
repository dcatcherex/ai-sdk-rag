import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { createAbVariant } from '@/features/analytics/service';
import { z } from 'zod';

const createSchema = z.object({
  contentPieceId: z.string().min(1),
  variantLabel: z.string().min(1),
  body: z.string().min(1),
});

async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
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
