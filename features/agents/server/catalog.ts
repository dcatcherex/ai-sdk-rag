import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
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
} from '../types';
import type { AgentSkillAttachmentInput } from '@/features/skills/types';
import {
  getResolvedSkillIdsByAgentIds,
  getSkillAttachmentsForAgent,
  replaceSkillAttachmentsForAgent,
} from '@/features/skills/service';
import { normalizeAgentBrandConfig } from './brand-config';

type AdminAgentTemplateInput = {
  name: string;
  description?: string | null;
  systemPrompt: string;
  modelId?: string | null;
  enabledTools?: string[];
  skillAttachments?: AgentSkillAttachmentInput[];
  starterTasks?: Agent['starterTasks'];
  brandId?: string | null;
  brandMode?: BrandMode;
  brandAccessPolicy?: BrandAccessPolicy;
  requiresBrandForRun?: boolean;
  fallbackBehavior?: FallbackBehavior;
  imageUrl?: string | null;
  cloneBehavior?: CloneBehavior;
  updatePolicy?: UpdatePolicy;
  lockedFields?: string[];
  changelog?: string | null;
  mcpServers?: Agent['mcpServers'];
};

function mapAgentRow(row: typeof agent.$inferSelect): Agent {
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

async function getNextCustomAgentName(userId: string, baseName: string): Promise<string> {
  const rows = await db
    .select({ name: agent.name })
    .from(agent)
    .where(eq(agent.userId, userId));

  const existingNames = new Set(rows.map((row) => row.name));
  const defaultName = `${baseName} (Custom)`;

  if (!existingNames.has(defaultName)) {
    return defaultName;
  }

  let index = 2;
  while (existingNames.has(`${baseName} (Custom ${index})`)) {
    index += 1;
  }

  return `${baseName} (Custom ${index})`;
}

export async function listAdminAgentTemplates(): Promise<Agent[]> {
  const rows = await db
    .select()
    .from(agent)
    .where(and(isNull(agent.userId), eq(agent.isTemplate, true), eq(agent.managedByAdmin, true)))
    .orderBy(desc(agent.updatedAt));

  return rows.map(mapAgentRow);
}

export async function getAdminAgentTemplateById(id: string): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, id), isNull(agent.userId), eq(agent.isTemplate, true), eq(agent.managedByAdmin, true)))
    .limit(1);

  return row ? mapAgentRow(row) : null;
}

export async function createAdminAgentTemplate(input: AdminAgentTemplateInput): Promise<Agent> {
  const now = new Date();
  const brandConfig = normalizeAgentBrandConfig({
    brandId: input.brandId,
    brandMode: input.brandMode,
    brandAccessPolicy: input.brandAccessPolicy,
    requiresBrandForRun: input.requiresBrandForRun,
    fallbackBehavior: input.fallbackBehavior,
  });
  const [row] = await db
    .insert(agent)
    .values({
      id: crypto.randomUUID(),
      userId: null,
      name: input.name,
      description: input.description ?? null,
      systemPrompt: input.systemPrompt,
      structuredBehavior: null,
      modelId: input.modelId ?? null,
      enabledTools: input.enabledTools ?? [],
      documentIds: [],
      skillIds: [],
      brandId: brandConfig.brandId,
      brandMode: brandConfig.brandMode,
      brandAccessPolicy: brandConfig.brandAccessPolicy,
      requiresBrandForRun: brandConfig.requiresBrandForRun,
      fallbackBehavior: brandConfig.fallbackBehavior,
      imageUrl: input.imageUrl ?? null,
      isPublic: false,
      starterTasks: input.starterTasks ?? [],
      isTemplate: true,
      templateId: null,
      isDefault: false,
      catalogScope: 'system',
      catalogStatus: 'draft',
      managedByAdmin: true,
      cloneBehavior: input.cloneBehavior ?? 'editable_copy',
      updatePolicy: input.updatePolicy ?? 'notify',
      lockedFields: input.lockedFields ?? [],
      version: 1,
      sourceTemplateVersion: null,
      publishedAt: null,
      archivedAt: null,
      changelog: input.changelog ?? null,
      mcpServers: input.mcpServers ?? [],
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if ((input.skillAttachments?.length ?? 0) > 0) {
    await replaceSkillAttachmentsForAgent(row!.id, input.skillAttachments ?? []);
  }

  return mapAgentRow(row!);
}

export async function updateAdminAgentTemplate(
  id: string,
  input: Partial<AdminAgentTemplateInput>,
): Promise<Agent | null> {
  let normalizedBrandConfig:
    | ReturnType<typeof normalizeAgentBrandConfig>
    | undefined;

  if (
    input.brandId !== undefined ||
    input.brandMode !== undefined ||
    input.brandAccessPolicy !== undefined ||
    input.requiresBrandForRun !== undefined ||
    input.fallbackBehavior !== undefined
  ) {
    const [existing] = await db
      .select({
        brandId: agent.brandId,
        brandMode: agent.brandMode,
        brandAccessPolicy: agent.brandAccessPolicy,
        requiresBrandForRun: agent.requiresBrandForRun,
        fallbackBehavior: agent.fallbackBehavior,
      })
      .from(agent)
      .where(and(eq(agent.id, id), isNull(agent.userId), eq(agent.isTemplate, true), eq(agent.managedByAdmin, true)))
      .limit(1);

    if (!existing) return null;

    normalizedBrandConfig = normalizeAgentBrandConfig({
      brandId: input.brandId ?? existing.brandId,
      brandMode: input.brandMode ?? (existing.brandMode as BrandMode),
      brandAccessPolicy: input.brandAccessPolicy ?? (existing.brandAccessPolicy as BrandAccessPolicy),
      requiresBrandForRun: input.requiresBrandForRun ?? existing.requiresBrandForRun,
      fallbackBehavior: input.fallbackBehavior ?? (existing.fallbackBehavior as FallbackBehavior),
    });
  }

  const [row] = await db
    .update(agent)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description ?? null }),
      ...(input.systemPrompt !== undefined && { systemPrompt: input.systemPrompt }),
      ...(input.modelId !== undefined && { modelId: input.modelId ?? null }),
      ...(input.enabledTools !== undefined && { enabledTools: input.enabledTools }),
      ...(normalizedBrandConfig && normalizedBrandConfig),
      ...(input.starterTasks !== undefined && { starterTasks: input.starterTasks }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl ?? null }),
      ...(input.cloneBehavior !== undefined && { cloneBehavior: input.cloneBehavior }),
      ...(input.updatePolicy !== undefined && { updatePolicy: input.updatePolicy }),
      ...(input.lockedFields !== undefined && { lockedFields: input.lockedFields }),
      ...(input.changelog !== undefined && { changelog: input.changelog ?? null }),
      ...(input.mcpServers !== undefined && { mcpServers: input.mcpServers }),
      updatedAt: new Date(),
    })
    .where(and(eq(agent.id, id), isNull(agent.userId), eq(agent.isTemplate, true), eq(agent.managedByAdmin, true)))
    .returning();

  if (row && input.skillAttachments !== undefined) {
    await replaceSkillAttachmentsForAgent(row.id, input.skillAttachments);
  }

  return row ? mapAgentRow(row) : null;
}

export async function publishAdminAgentTemplate(id: string, changelog?: string | null): Promise<Agent | null> {
  const existing = await getAdminAgentTemplateById(id);
  if (!existing) return null;

  const nextVersion = existing.catalogStatus === 'published' ? existing.version + 1 : existing.version;
  const [row] = await db
    .update(agent)
    .set({
      catalogStatus: 'published' satisfies CatalogStatus,
      version: nextVersion,
      publishedAt: new Date(),
      archivedAt: null,
      ...(changelog !== undefined ? { changelog: changelog ?? null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(agent.id, id))
    .returning();

  return row ? mapAgentRow(row) : null;
}

export async function deleteAdminAgentTemplate(id: string): Promise<boolean> {
  const result = await db
    .delete(agent)
    .where(and(eq(agent.id, id), isNull(agent.userId), eq(agent.isTemplate, true), eq(agent.managedByAdmin, true)))
    .returning({ id: agent.id });

  return result.length > 0;
}

export async function archiveAdminAgentTemplate(id: string): Promise<Agent | null> {
  const [row] = await db
    .update(agent)
    .set({
      catalogStatus: 'archived' satisfies CatalogStatus,
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(agent.id, id), isNull(agent.userId), eq(agent.isTemplate, true), eq(agent.managedByAdmin, true)))
    .returning();

  return row ? mapAgentRow(row) : null;
}

export async function usePublishedAgentTemplate(userId: string, templateId: string): Promise<Agent | null> {
  const [template] = await db
    .select()
    .from(agent)
    .where(
      and(
        eq(agent.id, templateId),
        isNull(agent.userId),
        eq(agent.isTemplate, true),
        eq(agent.managedByAdmin, true),
        eq(agent.catalogStatus, 'published'),
      ),
    )
    .limit(1);

  if (!template) return null;

  const resolvedAttachments = await getSkillAttachmentsForAgent(template.id);
  const now = new Date();
  const personalName = await getNextCustomAgentName(userId, template.name);
  const copy = {
    id: crypto.randomUUID(),
    userId,
    name: personalName,
    description: template.description,
    systemPrompt: template.systemPrompt,
    structuredBehavior: template.structuredBehavior,
    modelId: template.modelId,
    enabledTools: template.enabledTools,
    documentIds: [],
    skillIds: [],
    brandId: template.brandId,
    brandMode: template.brandMode,
    brandAccessPolicy: template.brandAccessPolicy,
    requiresBrandForRun: template.requiresBrandForRun,
    fallbackBehavior: template.fallbackBehavior,
    imageUrl: template.imageUrl,
    isPublic: false,
    starterTasks: template.starterTasks,
    isTemplate: false,
    templateId: template.id,
    isDefault: false,
    catalogScope: 'personal',
    catalogStatus: 'draft',
    managedByAdmin: false,
    cloneBehavior: template.cloneBehavior,
    updatePolicy: template.updatePolicy,
    lockedFields: [],
    version: 1,
    sourceTemplateVersion: template.version,
    publishedAt: null,
    archivedAt: null,
    changelog: null,
    mcpServers: template.mcpServers ?? [],
    createdAt: now,
    updatedAt: now,
  } satisfies typeof agent.$inferInsert;

  await db.insert(agent).values(copy);
  await replaceSkillAttachmentsForAgent(copy.id, resolvedAttachments.map((attachment) => ({
    skillId: attachment.skillId,
    isEnabled: attachment.isEnabled,
    activationModeOverride: attachment.activationModeOverride,
    triggerTypeOverride: attachment.triggerTypeOverride,
    triggerOverride: attachment.triggerOverride,
    priority: attachment.priority,
    notes: attachment.notes,
  })));

  const resolvedSkillIdsByAgentId = await getResolvedSkillIdsByAgentIds([copy.id]);
  return {
    ...copy,
    skillIds: resolvedSkillIdsByAgentId[copy.id] ?? [],
  } as Agent;
}
