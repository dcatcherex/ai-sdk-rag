import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent, lineOaChannel } from '@/db/schema';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  lineChannelId: z.string().min(1).optional(),
  channelSecret: z.string().min(1).optional(),
  channelAccessToken: z.string().min(1).optional(),
  agentId: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  memberRichMenuLineId: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = updateSchema.parse(await req.json());

  // Verify agentId belongs to the user (if being changed)
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

  const updated = await db
    .update(lineOaChannel)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.lineChannelId !== undefined && { lineChannelId: body.lineChannelId }),
      ...(body.channelSecret !== undefined && { channelSecret: body.channelSecret }),
      ...(body.channelAccessToken !== undefined && { channelAccessToken: body.channelAccessToken }),
      ...('agentId' in body && { agentId: body.agentId ?? null }),
      ...(body.status !== undefined && { status: body.status }),
      ...('memberRichMenuLineId' in body && { memberRichMenuLineId: body.memberRichMenuLineId ?? null }),
      updatedAt: new Date(),
    })
    .where(and(eq(lineOaChannel.id, id), eq(lineOaChannel.userId, session.user.id)))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ channel: updated[0] });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const deleted = await db
    .delete(lineOaChannel)
    .where(and(eq(lineOaChannel.id, id), eq(lineOaChannel.userId, session.user.id)))
    .returning({ id: lineOaChannel.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
