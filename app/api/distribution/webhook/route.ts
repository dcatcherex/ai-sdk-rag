import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { sendWebhookDistribution } from '@/features/distribution/service';
import { z } from 'zod';

const webhookSchema = z.object({
  contentPieceId: z.string().min(1),
  webhookUrl: z.string().url(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const result = webhookSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const record = await sendWebhookDistribution(userId, result.data);
  return NextResponse.json(record, { status: record.status === 'failed' ? 422 : 201 });
}
