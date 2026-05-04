import { and, desc, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { agentSkill, skillEvalRun } from '@/db/schema';

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

  const runs = await db
    .select()
    .from(skillEvalRun)
    .where(eq(skillEvalRun.skillId, skillId))
    .orderBy(desc(skillEvalRun.ranAt))
    .limit(20);

  return Response.json(runs);
}
