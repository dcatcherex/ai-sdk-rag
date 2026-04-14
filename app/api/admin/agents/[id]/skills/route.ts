import { and, eq, isNull } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { agent } from '@/db/schema';
import { getSkillAttachmentsForAgent } from '@/features/skills/service';

async function assertAdminTemplate(agentId: string) {
  const rows = await db
    .select({ id: agent.id })
    .from(agent)
    .where(
      and(
        eq(agent.id, agentId),
        isNull(agent.userId),
        eq(agent.isTemplate, true),
        eq(agent.managedByAdmin, true),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const template = await assertAdminTemplate(id);
  if (!template) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const attachments = await getSkillAttachmentsForAgent(id);
  return Response.json({ attachments });
}
