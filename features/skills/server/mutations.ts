import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { agentSkill, agentSkillFile, skillSource } from '@/db/schema';
import { fetchLatestGitHubCommitSha, loadSkillPackageFromUrl } from './package-import';
import { buildCreatedSkillFiles } from './package-files';
import { buildPackageManifest } from './package-manifest';
import { mapSkillRow, normaliseTrigger } from './shared';
import type { CreateSkillInput, Skill, UpdateSkillInput } from '../types';

export async function createSkill(userId: string, data: CreateSkillInput): Promise<Skill> {
  const now = new Date();
  const createdFiles = buildCreatedSkillFiles(data);
  const skillKind = data.skillKind ?? 'package';
  const [row] = await db
    .insert(agentSkill)
    .values({
      id: nanoid(),
      userId,
      name: data.name,
      description: data.description ?? null,
      triggerType: data.triggerType ?? 'always',
      trigger: normaliseTrigger(data.triggerType ?? 'always', data.trigger),
      promptFragment: data.promptFragment,
      enabledTools: data.enabledTools ?? [],
      sourceUrl: data.sourceUrl ?? null,
      skillKind,
      activationMode: data.activationMode ?? 'model',
      entryFilePath: 'SKILL.md',
      syncStatus: 'local',
      pinnedToInstalledVersion: false,
      hasBundledFiles: skillKind === 'package' && createdFiles.some((file) => file.relativePath !== 'SKILL.md'),
      packageManifest: skillKind === 'package' ? buildPackageManifest(createdFiles) : null,
      imageUrl: data.imageUrl ?? null,
      isPublic: data.isPublic ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (skillKind === 'package' && createdFiles.length > 0) {
    await db.insert(agentSkillFile).values(
      createdFiles.map((file) => ({
        id: nanoid(),
        skillId: row!.id,
        relativePath: file.relativePath,
        fileKind: file.fileKind,
        mediaType: file.mediaType,
        textContent: file.textContent,
        sizeBytes: file.sizeBytes,
        checksum: null,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  return mapSkillRow(row!);
}

export async function updateSkill(
  userId: string,
  skillId: string,
  data: UpdateSkillInput,
): Promise<Skill | null> {
  const [row] = await db
    .update(agentSkill)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.triggerType !== undefined && { triggerType: data.triggerType }),
      ...(data.trigger !== undefined && {
        trigger: normaliseTrigger(data.triggerType ?? 'keyword', data.trigger),
      }),
      ...(data.activationMode !== undefined && { activationMode: data.activationMode }),
      ...(data.promptFragment !== undefined && { promptFragment: data.promptFragment }),
      ...(data.enabledTools !== undefined && { enabledTools: data.enabledTools }),
      ...(data.sourceUrl !== undefined && { sourceUrl: data.sourceUrl ?? null }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl ?? null }),
      ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
    })
    .where(and(eq(agentSkill.id, skillId), eq(agentSkill.userId, userId)))
    .returning();

  if (!row) return null;
  return mapSkillRow(row);
}

export async function deleteSkill(userId: string, skillId: string): Promise<boolean> {
  const result = await db
    .delete(agentSkill)
    .where(and(eq(agentSkill.id, skillId), eq(agentSkill.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function installSkill(userId: string, skillId: string): Promise<Skill | null> {
  const [source] = await db
    .select()
    .from(agentSkill)
    .where(and(eq(agentSkill.id, skillId), eq(agentSkill.isPublic, true)))
    .limit(1);
  if (!source) return null;

  const now = new Date();
  const sourceFiles = await db
    .select()
    .from(agentSkillFile)
    .where(eq(agentSkillFile.skillId, source.id));

  const cloneId = nanoid();
  const [row] = await db
    .insert(agentSkill)
    .values({
      id: cloneId,
      userId,
      name: source.name,
      description: source.description,
      triggerType: source.triggerType,
      trigger: source.trigger,
      promptFragment: source.promptFragment,
      enabledTools: source.enabledTools,
      sourceUrl: source.sourceUrl,
      sourceId: source.sourceId,
      skillKind: source.skillKind,
      activationMode: source.activationMode,
      entryFilePath: source.entryFilePath,
      installedRef: source.installedRef,
      installedCommitSha: source.installedCommitSha,
      upstreamCommitSha: source.upstreamCommitSha,
      syncStatus: source.syncStatus,
      pinnedToInstalledVersion: source.pinnedToInstalledVersion,
      hasBundledFiles: source.hasBundledFiles,
      packageManifest: source.packageManifest,
      lastSyncCheckedAt: source.lastSyncCheckedAt,
      lastSyncedAt: source.lastSyncedAt,
      imageUrl: source.imageUrl,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (sourceFiles.length > 0) {
    await db.insert(agentSkillFile).values(
      sourceFiles.map((file) => ({
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

export async function importSkillFromUrl(
  userId: string,
  rawUrl: string,
): Promise<Skill> {
  const importedPackage = await loadSkillPackageFromUrl(rawUrl);
  const upstreamCommitSha = await fetchLatestGitHubCommitSha(importedPackage.source);
  const now = new Date();

  let sourceId: string;
  const [existingSource] = await db
    .select()
    .from(skillSource)
    .where(eq(skillSource.canonicalUrl, importedPackage.source.canonicalUrl))
    .limit(1);

  if (existingSource) {
    sourceId = existingSource.id;
  } else {
    sourceId = nanoid();

    await db.insert(skillSource).values({
      id: sourceId,
      sourceType: importedPackage.source.sourceType,
      canonicalUrl: importedPackage.source.canonicalUrl,
      repoOwner: importedPackage.source.repoOwner,
      repoName: importedPackage.source.repoName,
      repoRef: importedPackage.source.repoRef,
      subdirPath: importedPackage.source.subdirPath,
      defaultEntryPath: importedPackage.source.entryFilePath,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const [resolvedSource] = await db
      .select()
      .from(skillSource)
      .where(eq(skillSource.canonicalUrl, importedPackage.source.canonicalUrl))
      .limit(1);

    if (!resolvedSource) {
      throw new Error('Failed to resolve imported skill source');
    }

    sourceId = resolvedSource.id;
  }

  const skillId = nanoid();
  const [row] = await db
    .insert(agentSkill)
    .values({
      id: skillId,
      userId,
      name: importedPackage.parsed.name,
      description: importedPackage.parsed.description ?? `Imported skill: ${importedPackage.parsed.name}`,
      triggerType: importedPackage.parsed.triggerType,
      trigger: normaliseTrigger(importedPackage.parsed.triggerType, importedPackage.parsed.trigger),
      promptFragment: importedPackage.parsed.body,
      enabledTools: importedPackage.parsed.enabledTools,
      sourceUrl: importedPackage.source.sourceUrl,
      sourceId,
      skillKind: 'package',
      activationMode: 'rule',
      entryFilePath: importedPackage.source.entryFilePath,
      installedRef: importedPackage.source.repoRef,
      installedCommitSha: upstreamCommitSha,
      upstreamCommitSha,
      syncStatus: 'synced',
      pinnedToInstalledVersion: false,
      hasBundledFiles: importedPackage.files.some((file) => file.relativePath !== importedPackage.source.entryFilePath),
      packageManifest: importedPackage.manifest,
      lastSyncCheckedAt: now,
      lastSyncedAt: now,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (importedPackage.files.length > 0) {
    await db.insert(agentSkillFile).values(
      importedPackage.files.map((file) => ({
        id: nanoid(),
        skillId,
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
