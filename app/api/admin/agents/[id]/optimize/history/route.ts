import { desc, eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { agentAuditRun } from '@/db/schema';
import { parseStoredImprovementPlan } from '@/features/agents/server/stored-plan';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
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
    .where(eq(agentAuditRun.agentId, id))
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
