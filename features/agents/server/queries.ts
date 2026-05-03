import 'server-only';
import { and, eq, exists, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agent, agentShare } from '@/db/schema';
import type { Agent } from '@/features/agents/types';

// Returns the agent if it is owned by userId, public, admin-managed, or shared with userId.
export async function getAgentForUser(agentId: string, userId: string): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(
      and(
        eq(agent.id, agentId),
        or(
          eq(agent.userId, userId),
          eq(agent.isPublic, true),
          and(
            isNull(agent.userId),
            eq(agent.managedByAdmin, true),
            eq(agent.catalogStatus, 'published'),
          ),
          exists(
            db
              .select({ id: agentShare.agentId })
              .from(agentShare)
              .where(
                and(
                  eq(agentShare.agentId, agentId),
                  eq(agentShare.sharedWithUserId, userId),
                ),
              ),
          ),
        ),
      ),
    )
    .limit(1);
  return (row ?? null) as Agent | null;
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1);
  return (row ?? null) as Agent | null;
}
