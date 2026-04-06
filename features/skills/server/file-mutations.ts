import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { agentSkill, agentSkillFile, skillSource } from '@/db/schema';
import type { SkillFile, SkillFileKind } from '../types';
import { buildPackageManifest, guessSkillFileMediaType, inferSkillFileKind, normalizeReferencedPath } from './package-manifest';
import { parseSkillMarkdown } from './parser';
import { mapSkillFileRow, normaliseTrigger } from './shared';

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class SkillFileMutationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'SkillFileMutationError';
    this.statusCode = statusCode;
  }
}

type OwnedPackageSkillRecord = {
  skill: typeof agentSkill.$inferSelect;
  source: typeof skillSource.$inferSelect | null;
};

export async function createSkillFile(
  userId: string,
  skillId: string,
  relativePath: string,
  textContent: string,
): Promise<SkillFile> {
  const record = await getOwnedPackageSkillRecord(userId, skillId);
  const normalizedPath = normalizeSkillFilePath(relativePath);

  if (normalizedPath === record.skill.entryFilePath) {
    throw new SkillFileMutationError('The entry file already exists for this skill', 400);
  }

  const [existingFile] = await db
    .select()
    .from(agentSkillFile)
    .where(
      and(
        eq(agentSkillFile.skillId, skillId),
        eq(agentSkillFile.relativePath, normalizedPath),
      ),
    )
    .limit(1);

  if (existingFile) {
    throw new SkillFileMutationError('A bundled file already exists at that path', 409);
  }

  const normalizedContent = normalizeSkillFileContent(textContent);
  const now = new Date();

  const insertedFile = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(agentSkillFile)
      .values({
        id: nanoid(),
        skillId,
        relativePath: normalizedPath,
        fileKind: inferSkillFileKind(normalizedPath, record.skill.entryFilePath),
        mediaType: guessSkillFileMediaType(normalizedPath),
        textContent: normalizedContent,
        sizeBytes: normalizedContent.length,
        checksum: computeTextChecksum(normalizedContent),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await refreshPackageMetadata(tx, record);

    return row;
  });

  return mapSkillFileRow(insertedFile);
}

export async function updateSkillFileContent(
  userId: string,
  skillId: string,
  relativePath: string,
  textContent: string,
): Promise<SkillFile> {
  const record = await getOwnedPackageSkillRecord(userId, skillId);
  const normalizedPath = normalizeSkillFilePath(relativePath);
  const normalizedContent = normalizeSkillFileContent(textContent);
  const now = new Date();

  const updatedFile = await db.transaction(async (tx) => {
    const [existingFile] = await tx
      .select()
      .from(agentSkillFile)
      .where(
        and(
          eq(agentSkillFile.skillId, skillId),
          eq(agentSkillFile.relativePath, normalizedPath),
        ),
      )
      .limit(1);

    if (!existingFile) {
      throw new SkillFileMutationError('Bundled file not found', 404);
    }

    if (normalizedPath === record.skill.entryFilePath) {
      const parsed = parseSkillMarkdown(normalizedContent);
      validateParsedEntryFile(parsed);

      await tx
        .update(agentSkill)
        .set({
          name: parsed.name,
          description: parsed.description ?? null,
          triggerType: parsed.triggerType,
          trigger: normaliseTrigger(parsed.triggerType, parsed.trigger),
          promptFragment: parsed.body,
          updatedAt: now,
        })
        .where(eq(agentSkill.id, skillId));
    }

    const [row] = await tx
      .update(agentSkillFile)
      .set({
        mediaType: guessSkillFileMediaType(normalizedPath),
        textContent: normalizedContent,
        sizeBytes: normalizedContent.length,
        checksum: computeTextChecksum(normalizedContent),
        updatedAt: now,
      })
      .where(eq(agentSkillFile.id, existingFile.id))
      .returning();

    return row;
  });

  return mapSkillFileRow(updatedFile);
}

export async function deleteSkillFile(
  userId: string,
  skillId: string,
  relativePath: string,
): Promise<void> {
  const record = await getOwnedPackageSkillRecord(userId, skillId);
  const normalizedPath = normalizeSkillFilePath(relativePath);

  if (normalizedPath === record.skill.entryFilePath) {
    throw new SkillFileMutationError('The entry file cannot be deleted', 400);
  }

  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(agentSkillFile)
      .where(
        and(
          eq(agentSkillFile.skillId, skillId),
          eq(agentSkillFile.relativePath, normalizedPath),
        ),
      );

    if ((deleted.rowCount ?? 0) === 0) {
      throw new SkillFileMutationError('Bundled file not found', 404);
    }

    await refreshPackageMetadata(tx, record);
  });
}

async function getOwnedPackageSkillRecord(userId: string, skillId: string): Promise<OwnedPackageSkillRecord> {
  const [record] = await db
    .select({
      skill: agentSkill,
      source: skillSource,
    })
    .from(agentSkill)
    .leftJoin(skillSource, eq(agentSkill.sourceId, skillSource.id))
    .where(and(eq(agentSkill.id, skillId), eq(agentSkill.userId, userId)))
    .limit(1);

  if (!record) {
    throw new SkillFileMutationError('Skill not found', 404);
  }

  if (record.skill.skillKind !== 'package') {
    throw new SkillFileMutationError('Only package skills support bundled file editing', 400);
  }

  return record;
}

function normalizeSkillFilePath(relativePath: string): string {
  const normalizedPath = normalizeReferencedPath(relativePath);

  if (!normalizedPath) {
    throw new SkillFileMutationError('Invalid bundled file path', 400);
  }

  return normalizedPath;
}

function normalizeSkillFileContent(textContent: string): string {
  return textContent.replace(/\r\n/g, '\n');
}

function computeTextChecksum(textContent: string): string {
  return createHash('sha256').update(textContent).digest('hex');
}

function validateParsedEntryFile(parsed: ReturnType<typeof parseSkillMarkdown>): void {
  if (!SKILL_NAME_PATTERN.test(parsed.name)) {
    throw new SkillFileMutationError('Entry file name must stay in lowercase slug format', 400);
  }

  if ((parsed.description?.length ?? 0) > 1024) {
    throw new SkillFileMutationError('Entry file description is too long', 400);
  }

  if ((parsed.trigger?.length ?? 0) > 100) {
    throw new SkillFileMutationError('Entry file trigger is too long', 400);
  }

  if (parsed.body.trim().length === 0) {
    throw new SkillFileMutationError('Entry file body cannot be empty', 400);
  }
}

async function refreshPackageMetadata(
  tx: DbTransaction,
  record: OwnedPackageSkillRecord,
): Promise<void> {
  const fileRows = await tx
    .select({
      relativePath: agentSkillFile.relativePath,
      fileKind: agentSkillFile.fileKind,
    })
    .from(agentSkillFile)
    .where(eq(agentSkillFile.skillId, record.skill.id));

  const packageManifest = buildPackageManifest(
    fileRows.map((fileRow) => ({
      relativePath: fileRow.relativePath,
      fileKind: fileRow.fileKind as SkillFileKind,
    })),
    buildManifestSource(record.source),
  );

  await tx
    .update(agentSkill)
    .set({
      hasBundledFiles: fileRows.some((fileRow) => fileRow.relativePath !== record.skill.entryFilePath),
      packageManifest,
      updatedAt: new Date(),
    })
    .where(eq(agentSkill.id, record.skill.id));
}

function buildManifestSource(source: typeof skillSource.$inferSelect | null): {
  repo?: string;
  repoRef?: string;
  subdirPath?: string;
} | undefined {
  if (!source) {
    return undefined;
  }

  const repo = source.repoOwner && source.repoName
    ? `${source.repoOwner}/${source.repoName}`
    : undefined;

  return {
    ...(repo ? { repo } : {}),
    ...(source.repoRef ? { repoRef: source.repoRef } : {}),
    ...(source.subdirPath ? { subdirPath: source.subdirPath } : {}),
  };
}
