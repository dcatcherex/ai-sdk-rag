import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agentSkill, agentSkillAttachment, agentSkillFile, skillSource, user } from '@/db/schema';
import type { Skill, SkillDetail, SkillFile, SkillSource, SkillWithOwner } from '../types';
import { normalizeReferencedPath } from './package-manifest';
import { mapSkillFileRow, mapSkillRow, mapSkillSourceRow } from './shared';

export async function getSkills(userId: string): Promise<SkillWithOwner[]> {
  const rows = await db
    .select({
      skill: agentSkill,
      ownerName: user.name,
    })
    .from(agentSkill)
    .leftJoin(user, eq(agentSkill.userId, user.id))
    .where(or(eq(agentSkill.userId, userId), eq(agentSkill.isPublic, true)));

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
        : or(...skillIds.map((id) => eq(agentSkill.id, id))),
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

export async function getSkillById(userId: string, skillId: string): Promise<SkillDetail | null> {
  const row = await getSkillRecordForUser(userId, skillId);
  if (!row) return null;

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

async function getSkillRecordForUser(userId: string, skillId: string): Promise<{
  skill: typeof agentSkill.$inferSelect;
  source: typeof skillSource.$inferSelect | null;
} | null> {
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
        or(
          eq(agentSkill.userId, userId),
          eq(agentSkill.isPublic, true),
          and(
            isNull(agentSkill.userId),
            eq(agentSkill.isTemplate, true),
            eq(agentSkill.managedByAdmin, true),
            eq(agentSkill.catalogStatus, 'published'),
          ),
        ),
      ),
    )
    .limit(1);

  return row ?? null;
}

export function mapSkillSource(source: typeof skillSource.$inferSelect): SkillSource {
  return mapSkillSourceRow(source);
}
