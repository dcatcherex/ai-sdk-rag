import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent } from '@/db/schema';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  systemPrompt: z.string().min(1).optional(),
  modelId: z.string().optional().nullable(),
  enabledTools: z.array(z.string()).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = updateSchema.parse(await req.json());

  const existing = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, session.user.id)))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await db
    .update(agent)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(agent.id, id), eq(agent.userId, session.user.id)))
    .returning();

  return NextResponse.json({ agent: updated[0] });
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

  const existing = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, session.user.id)))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(agent).where(and(eq(agent.id, id), eq(agent.userId, session.user.id)));

  return NextResponse.json({ success: true });
}
