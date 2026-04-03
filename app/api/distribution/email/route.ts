import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { sendEmailDistribution } from '@/features/distribution/service';
import { z } from 'zod';

const emailSchema = z.object({
  contentPieceId: z.string().optional(),
  brandId: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1),
});

async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const result = emailSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const record = await sendEmailDistribution(userId, result.data);
  return NextResponse.json(record, { status: record.status === 'failed' ? 422 : 201 });
}
