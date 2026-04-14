import { and, desc, eq, isNull, ne, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { agentSkill, agentSkillFile } from '@/db/schema';
import type {
  CatalogStatus,
  CloneBehavior,
  Skill,
  SkillDetail,
  SkillWithOwner,
  UpdatePolicy,
} from '../types';
import { mapSkillFileRow, mapSkillRow, normaliseTrigger } from './shared';

type AdminSkillTemplateInput = {
  name: string;
  category?: string | null;
  description?: string | null;
  triggerType?: Skill['triggerType'];
  trigger?: string | null;
  promptFragment: string;
  enabledTools?: string[];
  activationMode?: Skill['activationMode'];
  imageUrl?: string | null;
  cloneBehavior?: CloneBehavior;
  updatePolicy?: UpdatePolicy;
  lockedFields?: string[];
  changelog?: string | null;
};

export type SkillCatalog = {
  skills: SkillWithOwner[];
  mine: SkillWithOwner[];
  essentials: SkillWithOwner[];
  community: SkillWithOwner[];
};

async function getNextCustomSkillName(userId: string, baseName: string): Promise<string> {
  const rows = await db
    .select({ name: agentSkill.name })
    .from(agentSkill)
    .where(eq(agentSkill.userId, userId));

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

export async function listAdminSkillTemplates(): Promise<Skill[]> {
  const rows = await db
    .select()
    .from(agentSkill)
    .where(and(isNull(agentSkill.userId), eq(agentSkill.isTemplate, true), eq(agentSkill.managedByAdmin, true)))
    .orderBy(desc(agentSkill.updatedAt));

  return rows.map(mapSkillRow);
}

export async function getAdminSkillTemplateById(skillId: string): Promise<SkillDetail | null> {
  const [row] = await db
    .select()
    .from(agentSkill)
    .where(and(eq(agentSkill.id, skillId), isNull(agentSkill.userId), eq(agentSkill.isTemplate, true), eq(agentSkill.managedByAdmin, true)))
    .limit(1);

  if (!row) return null;

  const files = await db
    .select()
    .from(agentSkillFile)
    .where(eq(agentSkillFile.skillId, skillId));

  return {
    ...mapSkillRow(row),
    files: files.map(mapSkillFileRow),
    source: null,
  };
}

export async function createAdminSkillTemplate(input: AdminSkillTemplateInput): Promise<Skill> {
  const now = new Date();
  const [row] = await db
    .insert(agentSkill)
    .values({
      id: nanoid(),
      userId: null,
      name: input.name,
      category: input.category ?? null,
      description: input.description ?? null,
      triggerType: input.triggerType ?? 'always',
      trigger: normaliseTrigger(input.triggerType ?? 'always', input.trigger),
      promptFragment: input.promptFragment,
      enabledTools: input.enabledTools ?? [],
      sourceUrl: null,
      sourceId: null,
      skillKind: 'inline',
      activationMode: input.activationMode ?? 'rule',
      entryFilePath: 'SKILL.md',
      installedRef: null,
      installedCommitSha: null,
      upstreamCommitSha: null,
      syncStatus: 'local',
      pinnedToInstalledVersion: false,
      hasBundledFiles: false,
      packageManifest: null,
      lastSyncCheckedAt: null,
      lastSyncedAt: null,
      imageUrl: input.imageUrl ?? null,
      isPublic: false,
      isTemplate: true,
      templateId: null,
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

  return mapSkillRow(row!);
}

export async function updateAdminSkillTemplate(
  skillId: string,
  input: Partial<AdminSkillTemplateInput>,
): Promise<Skill | null> {
  const [row] = await db
    .update(agentSkill)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.category !== undefined && { category: input.category ?? null }),
      ...(input.description !== undefined && { description: input.description ?? null }),
      ...(input.triggerType !== undefined && { triggerType: input.triggerType }),
      ...((input.triggerType !== undefined || input.trigger !== undefined) && {
        trigger: normaliseTrigger(
          input.triggerType,
          input.trigger,
        ),
      }),
      ...(input.promptFragment !== undefined && { promptFragment: input.promptFragment }),
      ...(input.enabledTools !== undefined && { enabledTools: input.enabledTools }),
      ...(input.activationMode !== undefined && { activationMode: input.activationMode }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl ?? null }),
      ...(input.cloneBehavior !== undefined && { cloneBehavior: input.cloneBehavior }),
      ...(input.updatePolicy !== undefined && { updatePolicy: input.updatePolicy }),
      ...(input.lockedFields !== undefined && { lockedFields: input.lockedFields }),
      ...(input.changelog !== undefined && { changelog: input.changelog ?? null }),
      updatedAt: new Date(),
    })
    .where(and(eq(agentSkill.id, skillId), isNull(agentSkill.userId), eq(agentSkill.isTemplate, true), eq(agentSkill.managedByAdmin, true)))
    .returning();

  return row ? mapSkillRow(row) : null;
}

export async function publishAdminSkillTemplate(skillId: string, changelog?: string | null): Promise<Skill | null> {
  const [existing] = await db
    .select()
    .from(agentSkill)
    .where(and(eq(agentSkill.id, skillId), isNull(agentSkill.userId), eq(agentSkill.isTemplate, true), eq(agentSkill.managedByAdmin, true)))
    .limit(1);

  if (!existing) return null;

  const nextVersion = existing.catalogStatus === 'published' ? existing.version + 1 : existing.version;
  const [row] = await db
    .update(agentSkill)
    .set({
      catalogStatus: 'published' satisfies CatalogStatus,
      version: nextVersion,
      publishedAt: new Date(),
      archivedAt: null,
      ...(changelog !== undefined ? { changelog: changelog ?? null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(agentSkill.id, skillId))
    .returning();

  return row ? mapSkillRow(row) : null;
}

export async function archiveAdminSkillTemplate(skillId: string): Promise<Skill | null> {
  const [row] = await db
    .update(agentSkill)
    .set({
      catalogStatus: 'archived' satisfies CatalogStatus,
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(agentSkill.id, skillId), isNull(agentSkill.userId), eq(agentSkill.isTemplate, true), eq(agentSkill.managedByAdmin, true)))
    .returning();

  return row ? mapSkillRow(row) : null;
}

export async function usePublishedSkillTemplate(userId: string, templateId: string): Promise<Skill | null> {
  const [template] = await db
    .select()
    .from(agentSkill)
    .where(
      and(
        eq(agentSkill.id, templateId),
        isNull(agentSkill.userId),
        eq(agentSkill.isTemplate, true),
        eq(agentSkill.managedByAdmin, true),
        eq(agentSkill.catalogStatus, 'published'),
      ),
    )
    .limit(1);

  if (!template) return null;

  const files = await db
    .select()
    .from(agentSkillFile)
    .where(eq(agentSkillFile.skillId, template.id));

  const now = new Date();
  const cloneId = nanoid();
  const personalName = await getNextCustomSkillName(userId, template.name);
  const [row] = await db
    .insert(agentSkill)
    .values({
      id: cloneId,
      userId,
      name: personalName,
      category: template.category,
      description: template.description,
      triggerType: template.triggerType,
      trigger: template.trigger,
      promptFragment: template.promptFragment,
      enabledTools: template.enabledTools,
      sourceUrl: template.sourceUrl,
      sourceId: template.sourceId,
      skillKind: template.skillKind,
      activationMode: template.activationMode,
      entryFilePath: template.entryFilePath,
      installedRef: template.installedRef,
      installedCommitSha: template.installedCommitSha,
      upstreamCommitSha: template.upstreamCommitSha,
      syncStatus: template.syncStatus,
      pinnedToInstalledVersion: template.pinnedToInstalledVersion,
      hasBundledFiles: template.hasBundledFiles,
      packageManifest: template.packageManifest,
      lastSyncCheckedAt: template.lastSyncCheckedAt,
      lastSyncedAt: template.lastSyncedAt,
      imageUrl: template.imageUrl,
      isPublic: false,
      isTemplate: false,
      templateId: template.id,
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
    })
    .returning();

  if (files.length > 0) {
    await db.insert(agentSkillFile).values(
      files.map((file) => ({
        id: nanoid(),
        skillId: cloneId,
        relativePath: file.relativePath,
        fileKind: file.fileKind,
        mediaType: file.mediaType,
        textContent: file.textContent,
        sizeBytes: file.sizeBytes,
        checksum: file.checksum,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  return mapSkillRow(row!);
}

export async function getSkillCatalog(userId: string): Promise<SkillCatalog> {
  const rows = await db
    .select()
    .from(agentSkill)
    .where(
      or(
        eq(agentSkill.userId, userId),
        and(
          isNull(agentSkill.userId),
          eq(agentSkill.isTemplate, true),
          eq(agentSkill.managedByAdmin, true),
          eq(agentSkill.catalogStatus, 'published'),
        ),
        and(eq(agentSkill.isPublic, true), or(isNull(agentSkill.userId), ne(agentSkill.userId, userId))),
      ),
    )
    .orderBy(desc(agentSkill.updatedAt));

  const mapped = rows.map((row) => mapSkillRow(row));
  const mine = mapped.filter((skill) => skill.userId === userId);
  const essentials = mapped.filter(
    (skill) =>
      skill.userId === null &&
      skill.isTemplate &&
      skill.managedByAdmin &&
      skill.catalogStatus === 'published',
  );
  const community = mapped.filter(
    (skill) =>
      skill.isPublic &&
      skill.userId !== userId &&
      !(skill.userId === null && skill.managedByAdmin && skill.isTemplate),
  );

  return {
    skills: mapped,
    mine,
    essentials,
    community,
  };
}
