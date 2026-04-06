import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent } from '@/db/schema';
import {
  getSkillAttachmentsForAgent,
  replaceSkillAttachmentsForAgent,
} from '@/features/skills/service';

const attachmentSchema = z.object({
  skillId: z.string().min(1),
  isEnabled: z.boolean().optional(),
  activationModeOverride: z.enum(['rule', 'model']).nullable().optional(),
  triggerTypeOverride: z.enum(['slash', 'keyword', 'always']).nullable().optional(),
  triggerOverride: z.string().max(100).nullable().optional(),
  priority: z.number().int().optional(),
  notes: z.string().nullable().optional(),
});

const putSchema = z.object({
  attachments: z.array(attachmentSchema),
});

async function assertOwnedAgent(agentId: string, userId: string) {
  const rows = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const ownedAgent = await assertOwnedAgent(id, session.user.id);
  if (!ownedAgent) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const attachments = await getSkillAttachmentsForAgent(id);
  return NextResponse.json({ attachments });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const ownedAgent = await assertOwnedAgent(id, session.user.id);
  if (!ownedAgent) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = putSchema.parse(await req.json());
  await replaceSkillAttachmentsForAgent(id, body.attachments);
  await db
    .update(agent)
    .set({ updatedAt: new Date() })
    .where(and(eq(agent.id, id), eq(agent.userId, session.user.id)));

  const attachments = await getSkillAttachmentsForAgent(id);
  return NextResponse.json({ attachments });
}
