import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { agentSkill, agentSkillAttachment, agentSkillFile, skillSource, user } from '@/db/schema';
import { loadSkillPackageFromUrl } from './server/package-import';
import type {
  AgentSkillAttachment,
  AgentSkillAttachmentInput,
  CreateSkillFileInput,
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

export async function getSkillAttachmentsForAgent(
  agentId: string,
  fallbackSkillIds: string[],
): Promise<AgentSkillAttachment[]> {
  const rows = await db
    .select({
      attachment: agentSkillAttachment,
      skill: agentSkill,
    })
    .from(agentSkillAttachment)
    .innerJoin(agentSkill, eq(agentSkillAttachment.skillId, agentSkill.id))
    .where(
      and(
        eq(agentSkillAttachment.agentId, agentId),
        eq(agentSkillAttachment.isEnabled, true),
      ),
    )
    .orderBy(asc(agentSkillAttachment.priority), asc(agentSkillAttachment.createdAt));

  if (rows.length > 0) {
    return rows.map(({ attachment, skill }) => ({
      ...attachment,
      activationModeOverride: attachment.activationModeOverride as SkillActivationMode | null,
      triggerTypeOverride: attachment.triggerTypeOverride as SkillTriggerType | null,
      skill: applySkillAttachmentOverrides(mapSkillRow(skill), attachment),
    }));
  }

  const fallbackSkills = await getSkillsByIds(fallbackSkillIds);
  return fallbackSkills.map((skill, index) => ({
    id: `legacy:${agentId}:${skill.id}`,
    agentId,
    skillId: skill.id,
    isEnabled: true,
    activationModeOverride: null,
    triggerTypeOverride: null,
    triggerOverride: null,
    priority: index,
    notes: null,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
    skill,
  }));
}

export async function getSkillsForAgent(agentId: string, fallbackSkillIds: string[]): Promise<Skill[]> {
  const attachments = await getSkillAttachmentsForAgent(agentId, fallbackSkillIds);
  return attachments.flatMap((attachment) => attachment.skill ? [attachment.skill] : []);
}

export async function replaceSkillAttachmentsForAgent(
  agentId: string,
  attachmentsOrSkillIds: string[] | AgentSkillAttachmentInput[],
): Promise<void> {
  const normalizedAttachments = normalizeAttachmentInputs(attachmentsOrSkillIds);
  const now = new Date();

  await db.delete(agentSkillAttachment).where(eq(agentSkillAttachment.agentId, agentId));

  if (normalizedAttachments.length > 0) {
    await db.insert(agentSkillAttachment).values(
      normalizedAttachments.map((attachment, index) => ({
        id: nanoid(),
        agentId,
        skillId: attachment.skillId,
        isEnabled: attachment.isEnabled ?? true,
        activationModeOverride: attachment.activationModeOverride ?? null,
        triggerTypeOverride: attachment.triggerTypeOverride ?? null,
        triggerOverride: normalizeAttachmentTrigger(attachment.triggerOverride),
        priority: attachment.priority ?? index,
        notes: attachment.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
}

export async function getSkillById(userId: string, skillId: string): Promise<SkillDetail | null> {
  const row = await getSkillRecordForUser(userId, skillId);

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

export async function getSkillFiles(userId: string, skillId: string): Promise<SkillFile[] | null> {
  const row = await getSkillRecordForUser(userId, skillId);
  if (!row) return null;

  const fileRows = await db
    .select()
    .from(agentSkillFile)
    .where(eq(agentSkillFile.skillId, skillId));

  return fileRows.map(mapSkillFileRow);
}

export async function getSkillFileContent(
  userId: string,
  skillId: string,
  relativePath: string,
): Promise<SkillFile | null> {
  const row = await getSkillRecordForUser(userId, skillId);
  if (!row) return null;

  const normalizedPath = normalizeReferencedPath(relativePath);
  if (!normalizedPath) return null;

  const [fileRow] = await db
    .select()
    .from(agentSkillFile)
    .where(
      and(
        eq(agentSkillFile.skillId, skillId),
        eq(agentSkillFile.relativePath, normalizedPath),
      ),
    )
    .limit(1);

  return fileRow ? mapSkillFileRow(fileRow) : null;
}

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
      packageManifest: skillKind === 'package' ? buildLocalPackageManifest(createdFiles) : null,
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

export async function getResolvedSkillResourcesForPrompt(
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
      const skillFiles = filesBySkillId[skill.id] ?? [];
      const explicitlyReferencedFiles = resolveReferencedPromptFiles(skill, skillFiles);
      const relevantFiles = explicitlyReferencedFiles.length > 0
        ? explicitlyReferencedFiles
        : selectRelevantReferenceFiles(skillFiles, messageTokens);
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

function buildCreatedSkillFiles(data: CreateSkillInput): Array<{
  relativePath: string;
  fileKind: SkillFile['fileKind'];
  mediaType: string | null;
  textContent: string;
  sizeBytes: number;
}> {
  const supplementalFiles = normalizeCreatedSkillFiles(data.files ?? []);
  const generatedSkillFile = {
    relativePath: 'SKILL.md',
    fileKind: 'skill' as const,
    mediaType: 'text/markdown',
    textContent: buildStandardSkillMarkdown(data),
    sizeBytes: buildStandardSkillMarkdown(data).length,
  };

  return [
    generatedSkillFile,
    ...supplementalFiles.filter((file) => file.relativePath !== 'SKILL.md'),
  ];
}

function normalizeCreatedSkillFiles(files: CreateSkillFileInput[]): Array<{
  relativePath: string;
  fileKind: SkillFile['fileKind'];
  mediaType: string | null;
  textContent: string;
  sizeBytes: number;
}> {
  const seen = new Set<string>();

  return files.flatMap((file) => {
    const relativePath = normalizeReferencedPath(file.relativePath);
    if (!relativePath || seen.has(relativePath)) return [];
    seen.add(relativePath);

    const textContent = file.textContent.replace(/\r\n/g, '\n');
    return [{
      relativePath,
      fileKind: inferSkillFileKind(relativePath),
      mediaType: guessSkillFileMediaType(relativePath),
      textContent,
      sizeBytes: textContent.length,
    }];
  });
}

function buildStandardSkillMarkdown(data: CreateSkillInput): string {
  const frontmatterLines = [
    '---',
    `name: ${data.name}`,
    `description: ${escapeFrontmatterValue(data.description)}`,
  ];

  if (data.license?.trim()) {
    frontmatterLines.push(`license: ${escapeFrontmatterValue(data.license.trim())}`);
  }

  if (data.compatibility?.trim()) {
    frontmatterLines.push(`compatibility: ${escapeFrontmatterValue(data.compatibility.trim())}`);
  }

  if (data.enabledTools && data.enabledTools.length > 0) {
    frontmatterLines.push(`allowed-tools: ${data.enabledTools.join(' ')}`);
  }

  if (data.metadata && Object.keys(data.metadata).length > 0) {
    frontmatterLines.push('metadata:');
    for (const [key, value] of Object.entries(data.metadata)) {
      frontmatterLines.push(`  ${key}: ${escapeFrontmatterValue(value)}`);
    }
  }

  frontmatterLines.push('---', '', data.promptFragment.trim());
  return frontmatterLines.join('\n').trim();
}

function escapeFrontmatterValue(value: string): string {
  const trimmed = value.trim();
  const escaped = trimmed.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function buildLocalPackageManifest(files: Array<{ relativePath: string; fileKind: SkillFile['fileKind'] }>): Record<string, unknown> {
  const counts = files.reduce(
    (acc, file) => {
      if (file.fileKind === 'reference') acc.references += 1;
      if (file.fileKind === 'asset') acc.assets += 1;
      if (file.fileKind === 'script') acc.scripts += 1;
      if (file.fileKind === 'other') acc.other += 1;
      return acc;
    },
    { references: 0, assets: 0, scripts: 0, other: 0 },
  );

  return {
    importedFileCount: files.length,
    counts,
    preservedAdditionalPaths: files
      .filter((file) => file.fileKind === 'other')
      .map((file) => file.relativePath),
  };
}

function inferSkillFileKind(relativePath: string): SkillFile['fileKind'] {
  if (relativePath === 'SKILL.md') return 'skill';
  const topLevelDir = relativePath.split('/')[0] ?? '';
  if (topLevelDir === 'references') return 'reference';
  if (topLevelDir === 'assets') return 'asset';
  if (topLevelDir === 'scripts') return 'script';
  return 'other';
}

function guessSkillFileMediaType(relativePath: string): string | null {
  const extension = relativePath.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'md' || extension === 'mdx') return 'text/markdown';
  if (extension === 'txt') return 'text/plain';
  if (extension === 'json') return 'application/json';
  if (extension === 'yaml' || extension === 'yml') return 'application/yaml';
  if (extension === 'js' || extension === 'mjs' || extension === 'cjs') return 'text/javascript';
  if (extension === 'ts' || extension === 'tsx') return 'text/typescript';
  if (extension === 'jsx') return 'text/jsx';
  if (extension === 'html') return 'text/html';
  if (extension === 'css' || extension === 'scss') return 'text/css';
  if (extension === 'py') return 'text/x-python';
  if (extension === 'sh') return 'application/x-sh';
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  return null;
}

function resolveReferencedPromptFiles(skill: Skill, files: SkillFile[]): SkillFile[] {
  return files
    .filter((file) => skill.promptFragment.includes(file.relativePath))
    .filter((file): file is SkillFile => isPromptInjectableFile(file));
}

function selectRelevantReferenceFiles(files: SkillFile[], messageTokens: Set<string>): SkillFile[] {
  return files
    .filter((file) => file.fileKind === 'reference' && isPromptInjectableFile(file))
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

function normalizeAttachmentInputs(
  attachmentsOrSkillIds: string[] | AgentSkillAttachmentInput[],
): AgentSkillAttachmentInput[] {
  if (attachmentsOrSkillIds.length === 0) return [];

  const rawItems = attachmentsOrSkillIds as Array<string | AgentSkillAttachmentInput>;
  let normalized: AgentSkillAttachmentInput[];

  if (rawItems.every((item): item is AgentSkillAttachmentInput => typeof item !== 'string')) {
    normalized = rawItems;
  } else {
    normalized = rawItems
      .filter((item): item is string => typeof item === 'string')
      .map((skillId, index) => ({
        skillId,
        isEnabled: true,
        priority: index,
      }));
  }

  const seen = new Set<string>();
  return normalized.filter((attachment) => {
    if (seen.has(attachment.skillId)) return false;
    seen.add(attachment.skillId);
    return true;
  });
}

function applySkillAttachmentOverrides(
  skill: Skill,
  attachment: typeof agentSkillAttachment.$inferSelect,
): Skill {
  const triggerType = (attachment.triggerTypeOverride as SkillTriggerType | null) ?? skill.triggerType;
  const trigger = attachment.triggerTypeOverride !== null || attachment.triggerOverride !== null
    ? normaliseTrigger(triggerType, attachment.triggerOverride)
    : skill.trigger;

  return {
    ...skill,
    activationMode: (attachment.activationModeOverride as SkillActivationMode | null) ?? skill.activationMode,
    triggerType,
    trigger,
  };
}

function normalizeAttachmentTrigger(trigger: string | null | undefined): string | null {
  if (trigger === undefined) return null;
  if (trigger === null) return null;
  const trimmed = trigger.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getSkillRecordForUser(userId: string, skillId: string) {
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

  return row ?? null;
}

function normalizeReferencedPath(path: string | null | undefined): string | null {
  if (!path) return null;

  const normalizedPath = path.trim().replace(/^\.\//, '').replace(/\\/g, '/');
  if (
    normalizedPath.length === 0 ||
    normalizedPath.startsWith('/') ||
    normalizedPath.includes('..')
  ) {
    return null;
  }

  const topLevelDir = normalizedPath.split('/')[0] ?? '';
  if (topLevelDir === '.git' || topLevelDir === 'node_modules') {
    return null;
  }

  return normalizedPath;
}

function isPromptInjectableFile(file: SkillFile | null): file is SkillFile {
  if (!file?.textContent) return false;
  if (file.fileKind === 'script') return false;
  return file.fileKind === 'reference' || file.fileKind === 'asset' || file.fileKind === 'other';
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
