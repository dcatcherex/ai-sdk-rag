import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent, agentShare, user as userTable } from '@/db/schema';

const bodySchema = z.object({ userId: z.string() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: agentId } = await params;
  const { userId: targetUserId } = bodySchema.parse(await req.json());

  const owned = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
    .limit(1);
  if (!owned.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const targetUser = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, targetUserId))
    .limit(1);
  if (!targetUser.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await db
    .insert(agentShare)
    .values({ id: crypto.randomUUID(), agentId, sharedWithUserId: targetUserId })
    .onConflictDoNothing();

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: agentId } = await params;
  const { userId: targetUserId } = bodySchema.parse(await req.json());

  const owned = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
    .limit(1);
  if (!owned.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db
    .delete(agentShare)
    .where(and(eq(agentShare.agentId, agentId), eq(agentShare.sharedWithUserId, targetUserId)));

  return NextResponse.json({ success: true });
}
