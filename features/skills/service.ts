import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { agentSkill, agentSkillAttachment, agentSkillFile, skillSource, user } from '@/db/schema';
import { loadSkillPackageFromUrl } from './server/package-import';
import type {
  SkillActivationMode,
  CreateSkillInput,
  Skill,
  SkillDetail,
  SkillFile,
  SkillSource,
  SkillTriggerType,
  SkillWithOwner,
  UpdateSkillInput,
} from './types';

export async function getSkills(userId: string): Promise<SkillWithOwner[]> {
  const rows = await db
    .select({
      skill: agentSkill,
      ownerName: user.name,
    })
    .from(agentSkill)
    .leftJoin(user, eq(agentSkill.userId, user.id))
    .where(or(eq(agentSkill.userId, userId), eq(agentSkill.isPublic, true)));

  // Deduplicate (own skills that happen to be public)
  const seen = new Set<string>();
  return rows
    .filter(({ skill }) => {
      if (seen.has(skill.id)) return false;
      seen.add(skill.id);
      return true;
    })
    .map(({ skill, ownerName }) => ({
      ...mapSkillRow(skill),
      ownerName: ownerName ?? undefined,
    }));
}

export async function getSkillsByIds(skillIds: string[]): Promise<Skill[]> {
  if (skillIds.length === 0) return [];
  const rows = await db
    .select()
    .from(agentSkill)
    .where(
      skillIds.length === 1
        ? eq(agentSkill.id, skillIds[0]!)
        : or(...skillIds.map((id) => eq(agentSkill.id, id)))
    );
  return rows.map(mapSkillRow);
}

export async function getResolvedSkillIdsByAgentIds(agentIds: string[]): Promise<Record<string, string[]>> {
  if (agentIds.length === 0) return {};

  const rows = await db
    .select({
      agentId: agentSkillAttachment.agentId,
      skillId: agentSkillAttachment.skillId,
    })
    .from(agentSkillAttachment)
    .where(
      and(
        inArray(agentSkillAttachment.agentId, agentIds),
        eq(agentSkillAttachment.isEnabled, true),
      ),
    )
    .orderBy(asc(agentSkillAttachment.priority), asc(agentSkillAttachment.createdAt));

  return rows.reduce<Record<string, string[]>>((acc, row) => {
    (acc[row.agentId] ??= []).push(row.skillId);
    return acc;
  }, {});
}

export async function getSkillsForAgent(agentId: string, fallbackSkillIds: string[]): Promise<Skill[]> {
  const attachmentMap = await getResolvedSkillIdsByAgentIds([agentId]);
  const skillIds = attachmentMap[agentId] ?? fallbackSkillIds;
  return getSkillsByIds(skillIds);
}

export async function replaceSkillAttachmentsForAgent(agentId: string, skillIds: string[]): Promise<void> {
  const uniqueSkillIds = [...new Set(skillIds)];
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.delete(agentSkillAttachment).where(eq(agentSkillAttachment.agentId, agentId));

    if (uniqueSkillIds.length > 0) {
      await tx.insert(agentSkillAttachment).values(
        uniqueSkillIds.map((skillId, index) => ({
          id: nanoid(),
          agentId,
          skillId,
          isEnabled: true,
          priority: index,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
  });
}

export async function getSkillById(userId: string, skillId: string): Promise<SkillDetail | null> {
  const [row] = await db
    .select({
      skill: agentSkill,
      source: skillSource,
    })
    .from(agentSkill)
    .leftJoin(skillSource, eq(agentSkill.sourceId, skillSource.id))
    .where(
      and(
        eq(agentSkill.id, skillId),
        or(eq(agentSkill.userId, userId), eq(agentSkill.isPublic, true)),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const fileRows = await db
    .select()
    .from(agentSkillFile)
    .where(eq(agentSkillFile.skillId, skillId));

  return {
    ...mapSkillRow(row.skill),
    files: fileRows.map(mapSkillFileRow),
    source: row.source ? mapSkillSourceRow(row.source) : null,
  };
}

export async function createSkill(userId: string, data: CreateSkillInput): Promise<Skill> {
  const now = new Date();
  const [row] = await db
    .insert(agentSkill)
    .values({
      id: nanoid(),
      userId,
      name: data.name,
      description: data.description ?? null,
      triggerType: data.triggerType,
      trigger: normaliseTrigger(data.triggerType, data.trigger),
      promptFragment: data.promptFragment,
      enabledTools: data.enabledTools ?? [],
      sourceUrl: data.sourceUrl ?? null,
      skillKind: 'inline',
      activationMode: data.activationMode ?? 'rule',
      entryFilePath: 'SKILL.md',
      syncStatus: 'local',
      pinnedToInstalledVersion: false,
      hasBundledFiles: false,
      isPublic: data.isPublic ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
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

/** Clone a public skill into the user's library (install from community gallery). */
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

  return db.transaction(async (tx) => {
    const cloneId = nanoid();
    const [row] = await tx
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
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (sourceFiles.length > 0) {
      await tx.insert(agentSkillFile).values(
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
  });
}

export async function importSkillFromUrl(
  userId: string,
  rawUrl: string,
): Promise<Skill> {
  const importedPackage = await loadSkillPackageFromUrl(rawUrl);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [existingSource] = await tx
      .select()
      .from(skillSource)
      .where(eq(skillSource.canonicalUrl, importedPackage.source.canonicalUrl))
      .limit(1);

    const sourceId = existingSource?.id ?? nanoid();

    if (!existingSource) {
      await tx.insert(skillSource).values({
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
      });
    }

    const skillId = nanoid();
    const [row] = await tx
      .insert(agentSkill)
      .values({
        id: skillId,
        userId,
        name: importedPackage.parsed.name,
        description: importedPackage.parsed.description ?? `Imported skill: ${importedPackage.parsed.name}`,
        triggerType: importedPackage.parsed.triggerType,
        trigger: normaliseTrigger(importedPackage.parsed.triggerType, importedPackage.parsed.trigger),
        promptFragment: importedPackage.parsed.body,
        enabledTools: [],
        sourceUrl: importedPackage.source.sourceUrl,
        sourceId,
        skillKind: 'package',
        activationMode: 'rule',
        entryFilePath: importedPackage.source.entryFilePath,
        installedRef: importedPackage.source.repoRef,
        installedCommitSha: null,
        upstreamCommitSha: null,
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
      await tx.insert(agentSkillFile).values(
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
  });
}

export function detectTriggeredSkills(skills: Skill[], userMessage: string): Skill[] {
  const msg = userMessage.trim();
  const msgLower = msg.toLowerCase();

  return skills.filter((skill) => {
    if (skill.activationMode === 'model') return false;
    if (skill.triggerType === 'always') return true;
    if (!skill.trigger) return false;

    if (skill.triggerType === 'slash') {
      const t = skill.trigger.startsWith('/') ? skill.trigger : `/${skill.trigger}`;
      return msg.startsWith(t) || msg.toLowerCase().startsWith(t.toLowerCase());
    }
    // keyword
    return msgLower.includes(skill.trigger.toLowerCase());
  });
}

export function selectModelDiscoveredSkills(skills: Skill[], userMessage: string): Skill[] {
  const normalizedMessage = tokenizeForSkillMatch(userMessage);

  return skills
    .filter((skill) => skill.activationMode === 'model')
    .map((skill) => ({
      skill,
      score: scoreSkillDiscovery(skill, normalizedMessage),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .slice(0, 2)
    .map((entry) => entry.skill);
}

export function buildAvailableSkillsCatalog(skills: Skill[]): string {
  const catalogSkills = skills.filter((skill) => skill.activationMode === 'model');
  if (catalogSkills.length === 0) return '';

  return '\n\n<available_skills>\n' +
    catalogSkills
      .map((skill) => `- ${skill.name}: ${skill.description ?? skill.promptFragment.slice(0, 120)}`)
      .join('\n') +
    '\n</available_skills>';
}

export async function getRelevantSkillResourcesForPrompt(
  skills: Skill[],
  userMessage: string,
): Promise<string> {
  if (skills.length === 0) return '';

  const skillIds = skills.map((skill) => skill.id);
  const fileRows = await db
    .select()
    .from(agentSkillFile)
    .where(inArray(agentSkillFile.skillId, skillIds));

  const filesBySkillId = fileRows.reduce<Record<string, SkillFile[]>>((acc, row) => {
    const file = mapSkillFileRow(row);
    (acc[file.skillId] ??= []).push(file);
    return acc;
  }, {});

  const messageTokens = tokenizeForSkillMatch(userMessage);
  const sections = skills
    .map((skill) => {
      const relevantFiles = selectRelevantReferenceFiles(filesBySkillId[skill.id] ?? [], messageTokens);
      if (relevantFiles.length === 0) return null;

      return `## Skill: ${skill.name}\n` + relevantFiles
        .map((file) => `### ${file.relativePath}\n${file.textContent}`)
        .join('\n\n');
    })
    .filter((section): section is string => Boolean(section));

  if (sections.length === 0) return '';

  return '\n\n<skill_resources>\n' + sections.join('\n\n') + '\n</skill_resources>';
}

function normaliseTrigger(
  triggerType: SkillTriggerType | undefined,
  trigger: string | null | undefined,
): string | null {
  if (triggerType === undefined) return trigger ?? null;
  if (triggerType === 'always') return null;
  if (!trigger) return null;
  if (triggerType === 'slash' && !trigger.startsWith('/')) return `/${trigger}`;
  return trigger;
}

function tokenizeForSkillMatch(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  );
}

function scoreSkillDiscovery(skill: Skill, messageTokens: Set<string>): number {
  if (messageTokens.size === 0) return 0;

  const haystack = `${skill.name} ${skill.description ?? ''} ${skill.promptFragment.slice(0, 280)}`.toLowerCase();
  let score = 0;

  for (const token of messageTokens) {
    if (haystack.includes(token)) {
      score += token.length >= 6 ? 2 : 1;
    }
  }

  return score;
}

function selectRelevantReferenceFiles(files: SkillFile[], messageTokens: Set<string>): SkillFile[] {
  return files
    .filter((file) => file.fileKind === 'reference' && Boolean(file.textContent))
    .map((file) => ({
      file,
      score: scoreReferenceFile(file, messageTokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.file.relativePath.localeCompare(b.file.relativePath))
    .slice(0, 2)
    .map((entry) => entry.file);
}

function scoreReferenceFile(file: SkillFile, messageTokens: Set<string>): number {
  if (!file.textContent || messageTokens.size === 0) return 0;

  const haystack = `${file.relativePath} ${file.textContent.slice(0, 600)}`.toLowerCase();
  let score = 0;

  for (const token of messageTokens) {
    if (haystack.includes(token)) {
      score += token.length >= 6 ? 2 : 1;
    }
  }

  return score;
}

function mapSkillRow(row: typeof agentSkill.$inferSelect): Skill {
  return {
    ...row,
    triggerType: row.triggerType as SkillTriggerType,
    skillKind: row.skillKind as Skill['skillKind'],
    activationMode: row.activationMode as Skill['activationMode'],
    syncStatus: row.syncStatus as Skill['syncStatus'],
    packageManifest: (row.packageManifest ?? null) as Record<string, unknown> | null,
  };
}

function mapSkillFileRow(row: typeof agentSkillFile.$inferSelect): SkillFile {
  return {
    ...row,
    fileKind: row.fileKind as SkillFile['fileKind'],
  };
}

function mapSkillSourceRow(row: typeof skillSource.$inferSelect): SkillSource {
  return row;
}
