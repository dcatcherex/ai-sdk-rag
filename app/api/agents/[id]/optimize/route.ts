import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { requireUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { agent, agentAuditRun } from '@/db/schema';
import { runAgentAudit } from '@/features/agents/server/audit-service';
import { generateImprovementPlan } from '@/features/agents/server/optimizer';

const bodySchema = z.object({
  testMessage: z.string().max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: 'Bad Request' }, { status: 400 });

  const { id } = await params;
  const testMessage = body.data.testMessage ?? '';

  // Verify ownership
  const [agentRow] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, authResult.user.id)))
    .limit(1);

  if (!agentRow) return Response.json({ error: 'Not found' }, { status: 404 });

  const result = await runAgentAudit(id, testMessage);
  if (!result) return Response.json({ error: 'Not found' }, { status: 404 });

  const { audit, snapshot } = result;

  if (audit.summary.readinessScore === 100) {
    return Response.json({
      auditRunId: null,
      plan: { agentId: id, estimatedScoreAfter: 100, reasoning: 'Agent is already fully optimized.', changes: [] },
      scoreBefore: 100,
      statusBefore: 'ready',
    });
  }

  const plan = await generateImprovementPlan(id, audit, snapshot);

  const [auditRun] = await db
    .insert(agentAuditRun)
    .values({
      id: nanoid(),
      agentId: id,
      userId: authResult.user.id,
      scoreBefore: audit.summary.readinessScore,
      statusBefore: audit.summary.status,
      testMessage,
      findings: audit.findings,
      plan,
      appliedChangeIds: [],
    })
    .returning();

  return Response.json({
    auditRunId: auditRun.id,
    plan,
    scoreBefore: audit.summary.readinessScore,
    statusBefore: audit.summary.status,
  });
}
