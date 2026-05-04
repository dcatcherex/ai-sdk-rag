import { nanoid } from 'nanoid';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { requireUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { agentSkill, skillEvalCase } from '@/db/schema';

const createCaseSchema = z.object({
  message: z.string().min(1).max(2000),
  shouldActivate: z.boolean(),
  label: z.string().max(100).optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { id: skillId } = await params;

  const [skill] = await db
    .select({ id: agentSkill.id })
    .from(agentSkill)
    .where(and(eq(agentSkill.id, skillId), eq(agentSkill.userId, authResult.user.id)))
    .limit(1);

  if (!skill) return new Response('Not Found', { status: 404 });

  const cases = await db
    .select()
    .from(skillEvalCase)
    .where(eq(skillEvalCase.skillId, skillId))
    .orderBy(asc(skillEvalCase.createdAt));

  return Response.json(cases);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { id: skillId } = await params;

  const [skill] = await db
    .select({ id: agentSkill.id })
    .from(agentSkill)
    .where(and(eq(agentSkill.id, skillId), eq(agentSkill.userId, authResult.user.id)))
    .limit(1);

  if (!skill) return new Response('Not Found', { status: 404 });

  const body = await req.json();
  const parsed = createCaseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Bad Request', details: parsed.error.flatten() }, { status: 400 });
  }

  const [created] = await db
    .insert(skillEvalCase)
    .values({
      id: nanoid(),
      skillId,
      message: parsed.data.message,
      shouldActivate: parsed.data.shouldActivate,
      label: parsed.data.label ?? null,
    })
    .returning();

  return Response.json(created, { status: 201 });
}
