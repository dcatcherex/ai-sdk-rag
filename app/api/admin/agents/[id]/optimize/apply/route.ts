import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { agentAuditRun } from '@/db/schema';
import { applyImprovementPlan } from '@/features/agents/server/optimizer-apply';
import type { ImprovementPlan } from '@/features/agents/types/optimizer';
import { parseStoredImprovementPlan } from '@/features/agents/server/stored-plan';

const bodySchema = z.object({
  auditRunId: z.string().min(1),
  changeIds: z.array(z.string().min(1)).min(1).max(20),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = bodySchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: 'Bad Request' }, { status: 400 });

  const { id } = await params;
  const { auditRunId, changeIds } = body.data;

  const [run] = await db
    .select()
    .from(agentAuditRun)
    .where(eq(agentAuditRun.id, auditRunId))
    .limit(1);

  if (!run || run.agentId !== id) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

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
    adminCheck.session.user.id,
    true,
    plan,
    changeIds,
  );

  return Response.json(result);
}
