import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent, lineOaChannel } from '@/db/schema';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  lineChannelId: z.string().min(1),
  channelSecret: z.string().min(1),
  channelAccessToken: z.string().min(1),
  agentId: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const channels = await db
    .select({
      id: lineOaChannel.id,
      name: lineOaChannel.name,
      lineChannelId: lineOaChannel.lineChannelId,
      agentId: lineOaChannel.agentId,
      imageUrl: lineOaChannel.imageUrl,
      status: lineOaChannel.status,
      memberRichMenuLineId: lineOaChannel.memberRichMenuLineId,
      createdAt: lineOaChannel.createdAt,
      updatedAt: lineOaChannel.updatedAt,
      agentName: agent.name,
    })
    .from(lineOaChannel)
    .leftJoin(agent, eq(lineOaChannel.agentId, agent.id))
    .where(eq(lineOaChannel.userId, session.user.id))
    .orderBy(desc(lineOaChannel.createdAt));

  return NextResponse.json({ channels });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = createSchema.parse(await req.json());

  // Verify agentId belongs to the user (if provided)
  if (body.agentId) {
    const agentRow = await db
      .select({ id: agent.id })
      .from(agent)
      .where(and(eq(agent.id, body.agentId), eq(agent.userId, session.user.id)))
      .limit(1);
    if (agentRow.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
  }

  const newChannel = {
    id: crypto.randomUUID(),
    userId: session.user.id,
    name: body.name,
    lineChannelId: body.lineChannelId,
    channelSecret: body.channelSecret,
    channelAccessToken: body.channelAccessToken,
    agentId: body.agentId ?? null,
    imageUrl: body.imageUrl ?? null,
    status: body.status ?? 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(lineOaChannel).values(newChannel);

  return NextResponse.json({ channel: newChannel }, { status: 201 });
}
