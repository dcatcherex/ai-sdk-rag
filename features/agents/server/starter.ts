import { and, count, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { getPlatformSettings } from '@/lib/platform-settings';
import { agent } from '@/db/schema';
import type {
  Agent,
  BrandAccessPolicy,
  BrandMode,
  CatalogScope,
  CatalogStatus,
  CloneBehavior,
  FallbackBehavior,
  UpdatePolicy,
} from '@/features/agents/types';
import { usePublishedAgentTemplate } from './catalog';

type StarterAgentCandidate = typeof agent.$inferSelect;

function mapAgentRow(row: StarterAgentCandidate): Agent {
  return {
    ...row,
    catalogScope: row.catalogScope as CatalogScope,
    catalogStatus: row.catalogStatus as CatalogStatus,
    cloneBehavior: row.cloneBehavior as CloneBehavior,
    updatePolicy: row.updatePolicy as UpdatePolicy,
    brandMode: row.brandMode as BrandMode,
    brandAccessPolicy: row.brandAccessPolicy as BrandAccessPolicy,
    fallbackBehavior: row.fallbackBehavior as FallbackBehavior,
  };
}

async function getPublishedAdminStarterById(agentId: string | null): Promise<Agent | null> {
  if (!agentId) return null;

  const [row] = await db
    .select()
    .from(agent)
    .where(
      and(
        eq(agent.id, agentId),
        isNull(agent.userId),
        eq(agent.managedByAdmin, true),
        eq(agent.catalogStatus, 'published'),
      ),
    )
    .limit(1);

  return row ? mapAgentRow(row) : null;
}

export async function getConfiguredGuestStarterAgent(): Promise<Agent | null> {
  const settings = await getPlatformSettings();
  return getPublishedAdminStarterById(settings.guestStarterAgentId);
}

export async function ensureConfiguredStarterAgentForUser(userId: string): Promise<Agent | null> {
  const existingCountRows = await db
    .select({ count: count() })
    .from(agent)
    .where(eq(agent.userId, userId));

  if ((existingCountRows[0]?.count ?? 0) > 0) {
    return null;
  }

  const settings = await getPlatformSettings();
  if (!settings.newUserStarterTemplateId) {
    return null;
  }

  const copy = await usePublishedAgentTemplate(userId, settings.newUserStarterTemplateId);
  if (!copy) {
    return null;
  }

  const [updated] = await db
    .update(agent)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(and(eq(agent.id, copy.id), eq(agent.userId, userId)))
    .returning();

  return updated ? mapAgentRow(updated) : copy;
}
