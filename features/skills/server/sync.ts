import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { agentSkill, agentSkillFile, skillSource } from '@/db/schema';
import type { SkillFile, SkillSyncApplyResult, SkillSyncCheckResult } from '../types';
import {
  buildGitHubSkillSourceFromStoredSource,
  fetchLatestGitHubCommitSha,
  loadSkillPackageFromSource,
} from './package-import';
import { buildPackageManifest } from './package-manifest';
import { mapSkillFileRow, mapSkillRow, normaliseTrigger } from './shared';
import { calculateChangedFilePaths } from './sync-shared';

type OwnedSyncableSkillRecord = {
  skill: typeof agentSkill.$inferSelect;
  source: typeof skillSource.$inferSelect;
  files: SkillFile[];
};

type RemotePackageSnapshot = {
  files: Awaited<ReturnType<typeof loadSkillPackageFromSource>>['files'];
  parsed: Awaited<ReturnType<typeof loadSkillPackageFromSource>>['parsed'];
  manifest: Awaited<ReturnType<typeof loadSkillPackageFromSource>>['manifest'];
  upstreamCommitSha: string | null;
};

export async function checkSkillSync(userId: string, skillId: string): Promise<SkillSyncCheckResult> {
  const record = await getOwnedSyncableSkillRecord(userId, skillId);
  const remote = await loadRemotePackageSnapshot(record.source);
  const changedFiles = calculateChangedFilePaths(record.files, remote.files);
  const checkedAt = new Date();
  const status = changedFiles.length === 0 ? 'synced' : 'update_available';

  await db
    .update(agentSkill)
    .set({
      upstreamCommitSha: remote.upstreamCommitSha,
      syncStatus: status,
      lastSyncCheckedAt: checkedAt,
      updatedAt: checkedAt,
    })
    .where(eq(agentSkill.id, record.skill.id));

  return {
    status,
    installedCommitSha: record.skill.installedCommitSha,
    upstreamCommitSha: remote.upstreamCommitSha,
    changedFiles,
    checkedAt,
  };
}

export async function applySkillSync(userId: string, skillId: string): Promise<SkillSyncApplyResult> {
  const record = await getOwnedSyncableSkillRecord(userId, skillId);
  const remote = await loadRemotePackageSnapshot(record.source);
  const changedFiles = calculateChangedFilePaths(record.files, remote.files);
  const now = new Date();

  const updatedSkill = await db.transaction(async (tx) => {
    await tx
      .delete(agentSkillFile)
      .where(eq(agentSkillFile.skillId, record.skill.id));

    if (remote.files.length > 0) {
      await tx.insert(agentSkillFile).values(
        remote.files.map((file) => ({
          id: nanoid(),
          skillId: record.skill.id,
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

    const [row] = await tx
      .update(agentSkill)
      .set({
        name: remote.parsed.name,
        description: remote.parsed.description ?? `Imported skill: ${remote.parsed.name}`,
        triggerType: remote.parsed.triggerType,
        trigger: normaliseTrigger(remote.parsed.triggerType, remote.parsed.trigger),
        promptFragment: remote.parsed.body,
        entryFilePath: record.source.defaultEntryPath,
        installedRef: record.source.repoRef,
        installedCommitSha: remote.upstreamCommitSha,
        upstreamCommitSha: remote.upstreamCommitSha,
        syncStatus: 'synced',
        hasBundledFiles: remote.files.some((file) => file.relativePath !== record.source.defaultEntryPath),
        packageManifest: remote.manifest ?? buildPackageManifest(remote.files, {
          repo: record.source.repoOwner && record.source.repoName
            ? `${record.source.repoOwner}/${record.source.repoName}`
            : undefined,
          repoRef: record.source.repoRef ?? undefined,
          subdirPath: record.source.subdirPath ?? undefined,
        }),
        lastSyncCheckedAt: now,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(agentSkill.id, record.skill.id))
      .returning();

    return row;
  });

  return {
    status: 'synced',
    installedCommitSha: remote.upstreamCommitSha,
    upstreamCommitSha: remote.upstreamCommitSha,
    changedFiles,
    checkedAt: now,
    skill: mapSkillRow(updatedSkill!),
  };
}

async function getOwnedSyncableSkillRecord(userId: string, skillId: string): Promise<OwnedSyncableSkillRecord> {
  const [record] = await db
    .select({
      skill: agentSkill,
      source: skillSource,
    })
    .from(agentSkill)
    .innerJoin(skillSource, eq(agentSkill.sourceId, skillSource.id))
    .where(and(eq(agentSkill.id, skillId), eq(agentSkill.userId, userId)))
    .limit(1);

  if (!record) {
    throw new Error('Skill not found');
  }

  if (record.skill.skillKind !== 'package') {
    throw new Error('Only imported package skills support sync');
  }

  const fileRows = await db
    .select()
    .from(agentSkillFile)
    .where(eq(agentSkillFile.skillId, record.skill.id));

  return {
    skill: record.skill,
    source: record.source,
    files: fileRows.map(mapSkillFileRow),
  };
}

async function loadRemotePackageSnapshot(sourceRecord: typeof skillSource.$inferSelect): Promise<RemotePackageSnapshot> {
  const source = buildGitHubSkillSourceFromStoredSource(sourceRecord);
  const [pkg, upstreamCommitSha] = await Promise.all([
    loadSkillPackageFromSource(source),
    fetchLatestGitHubCommitSha(source),
  ]);

  return {
    files: pkg.files,
    parsed: pkg.parsed,
    manifest: pkg.manifest,
    upstreamCommitSha,
  };
}
