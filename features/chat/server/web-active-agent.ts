import { count, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agent } from '@/db/schema';
import type { Agent } from '@/features/agents/types';
import {
  ensureConfiguredStarterAgentForUser,
  getConfiguredGuestStarterAgent,
} from '@/features/agents/server/starter';

export type ResolvedWebActiveAgent = {
  activeAgent: Agent | null;
  requiresConfiguredStarterTemplate: boolean;
};

export async function resolveWebActiveAgent(input: {
  isGuest: boolean;
  requestedAgentId?: string | null;
  effectiveUserId: string;
  activeAgentRow: Agent | null;
}): Promise<ResolvedWebActiveAgent> {
  const { isGuest, requestedAgentId, effectiveUserId, activeAgentRow } = input;

  let activeAgent: Agent | null = activeAgentRow;
  let requiresConfiguredStarterTemplate = false;

  if (!activeAgent) {
    if (isGuest) {
      const starterAgent = await getConfiguredGuestStarterAgent();
      if (starterAgent) {
        activeAgent = starterAgent;
      }
    } else if (!requestedAgentId) {
      const starterAgent = await ensureConfiguredStarterAgentForUser(effectiveUserId);
      if (starterAgent) {
        activeAgent = starterAgent;
      } else {
        const agentCountRows = await db
          .select({ count: count() })
          .from(agent)
          .where(eq(agent.userId, effectiveUserId));
        requiresConfiguredStarterTemplate = (agentCountRows[0]?.count ?? 0) === 0;
      }
    }
  }

  return {
    activeAgent,
    requiresConfiguredStarterTemplate,
  };
}
