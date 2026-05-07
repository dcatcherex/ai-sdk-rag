import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { agent, agentAuditRun } from '@/db/schema';
import { applyImprovementPlan } from '@/features/agents/server/optimizer-apply';
import { parseStoredImprovementPlan } from '@/features/agents/server/stored-plan';

const bodySchema = z.object({
  auditRunId: z.string().min(1),
  changeIds: z.array(z.string().min(1)).min(1).max(20),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = bodySchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: 'Bad Request' }, { status: 400 });

  const { id } = await params;
  const { auditRunId, changeIds } = body.data;

  // Verify ownership
  const [agentRow] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, authResult.user.id)))
    .limit(1);

  if (!agentRow) return Response.json({ error: 'Not found' }, { status: 404 });

  const [run] = await db
    .select()
    .from(agentAuditRun)
    .where(and(eq(agentAuditRun.id, auditRunId), eq(agentAuditRun.agentId, id), eq(agentAuditRun.userId, authResult.user.id)))
    .limit(1);

  if (!run) return Response.json({ error: 'Not found' }, { status: 404 });

  const plan = parseStoredImprovementPlan(run.plan, {
    agentId: id,
    scoreBefore: run.scoreBefore,
    scoreAfter: run.scoreAfter,
  });

  if (!plan) {
    return Response.json({ error: 'Invalid stored plan' }, { status: 500 });
  }

  const result = await applyImprovementPlan(
    auditRunId,
    id,
    authResult.user.id,
    false,
    plan,
    changeIds,
  );

  return Response.json(result);
}
