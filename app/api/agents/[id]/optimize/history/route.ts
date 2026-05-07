import { and, desc, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { agent, agentAuditRun } from '@/db/schema';
import { parseStoredImprovementPlan } from '@/features/agents/server/stored-plan';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;

  // Verify ownership
  const [agentRow] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, authResult.user.id)))
    .limit(1);

  if (!agentRow) return Response.json({ error: 'Not found' }, { status: 404 });

  const runs = await db
    .select({
      id: agentAuditRun.id,
      scoreBefore: agentAuditRun.scoreBefore,
      scoreAfter: agentAuditRun.scoreAfter,
      statusBefore: agentAuditRun.statusBefore,
      statusAfter: agentAuditRun.statusAfter,
      testMessage: agentAuditRun.testMessage,
      plan: agentAuditRun.plan,
      appliedChangeIds: agentAuditRun.appliedChangeIds,
      createdAt: agentAuditRun.createdAt,
    })
    .from(agentAuditRun)
    .where(and(eq(agentAuditRun.agentId, id), eq(agentAuditRun.userId, authResult.user.id)))
    .orderBy(desc(agentAuditRun.createdAt))
    .limit(20);

  return Response.json({
    runs: runs.map((run) => ({
      ...run,
      plan: parseStoredImprovementPlan(run.plan, {
        agentId: id,
        scoreBefore: run.scoreBefore,
        scoreAfter: run.scoreAfter,
      }),
    })),
  });
}
