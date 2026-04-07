import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { createAudience } from '@/features/line-oa/broadcast/service';

const createAudienceSchema = z.object({
  name: z.string().min(1).max(100),
  lineUserIds: z.array(z.string().min(1)).min(1).max(10000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: channelId } = await params;
  const body = createAudienceSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });

  const audience = await createAudience(channelId, session.user.id, body.data);
  return NextResponse.json(audience, { status: 201 });
}
