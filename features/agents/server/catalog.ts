import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { agent } from '@/db/schema';
import type { Agent, CatalogScope, CatalogStatus, CloneBehavior, UpdatePolicy } from '../types';
import {
  getResolvedSkillIdsByAgentIds,
  getSkillAttachmentsForAgent,
  replaceSkillAttachmentsForAgent,
} from '@/features/skills/service';

type AdminAgentTemplateInput = {
  name: string;
  description?: string | null;
  systemPrompt: string;
  modelId?: string | null;
  enabledTools?: string[];
  starterPrompts?: string[];
  imageUrl?: string | null;
  cloneBehavior?: CloneBehavior;
  updatePolicy?: UpdatePolicy;
  lockedFields?: string[];
  changelog?: string | null;
};

function mapAgentRow(row: typeof agent.$inferSelect): Agent {
  return {
    ...row,
    catalogScope: row.catalogScope as CatalogScope,
    catalogStatus: row.catalogStatus as CatalogStatus,
    cloneBehavior: row.cloneBehavior as CloneBehavior,
    updatePolicy: row.updatePolicy as UpdatePolicy,
  };
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
      brandId: null,
      imageUrl: input.imageUrl ?? null,
      isPublic: false,
      starterPrompts: input.starterPrompts ?? [],
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
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return mapAgentRow(row!);
}

export async function updateAdminAgentTemplate(
  id: string,
  input: Partial<AdminAgentTemplateInput>,
): Promise<Agent | null> {
  const [row] = await db
    .update(agent)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description ?? null }),
      ...(input.systemPrompt !== undefined && { systemPrompt: input.systemPrompt }),
      ...(input.modelId !== undefined && { modelId: input.modelId ?? null }),
      ...(input.enabledTools !== undefined && { enabledTools: input.enabledTools }),
      ...(input.starterPrompts !== undefined && { starterPrompts: input.starterPrompts }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl ?? null }),
      ...(input.cloneBehavior !== undefined && { cloneBehavior: input.cloneBehavior }),
      ...(input.updatePolicy !== undefined && { updatePolicy: input.updatePolicy }),
      ...(input.lockedFields !== undefined && { lockedFields: input.lockedFields }),
      ...(input.changelog !== undefined && { changelog: input.changelog ?? null }),
      updatedAt: new Date(),
    })
    .where(and(eq(agent.id, id), isNull(agent.userId), eq(agent.isTemplate, true), eq(agent.managedByAdmin, true)))
    .returning();

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
  const copy = {
    id: crypto.randomUUID(),
    userId,
    name: template.name,
    description: template.description,
    systemPrompt: template.systemPrompt,
    structuredBehavior: template.structuredBehavior,
    modelId: template.modelId,
    enabledTools: template.enabledTools,
    documentIds: [],
    skillIds: [],
    brandId: null,
    imageUrl: template.imageUrl,
    isPublic: false,
    starterPrompts: template.starterPrompts,
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
