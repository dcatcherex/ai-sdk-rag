import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  getAgentUserToolAttachments,
  replaceAgentUserToolAttachments,
} from "@/features/user-tools/service";
import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { agent } from '@/db/schema';

type Params = { params: Promise<{ id: string }> };

const attachmentSchema = z.object({
  userToolId: z.string().min(1),
  isEnabled: z.boolean().optional(),
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

export async function GET(_: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const ownedAgent = await assertOwnedAgent(id, authResult.user.id);
  if (!ownedAgent) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const attachments = await getAgentUserToolAttachments(id, authResult.user.id);
  if (attachments === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ attachments });
}

export async function PUT(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const ownedAgent = await assertOwnedAgent(id, authResult.user.id);
  if (!ownedAgent) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = putSchema.parse(await req.json());
  await replaceAgentUserToolAttachments(id, body.attachments, authResult.user.id);
  await db
    .update(agent)
    .set({ updatedAt: new Date() })
    .where(and(eq(agent.id, id), eq(agent.userId, authResult.user.id)));

  const attachments = await getAgentUserToolAttachments(id, authResult.user.id);
  return Response.json({ attachments: attachments ?? [] });
}
