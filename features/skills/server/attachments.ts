import { and, asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { agentSkill, agentSkillAttachment } from '@/db/schema';
import type {
  AgentSkillAttachment,
  AgentSkillAttachmentInput,
  Skill,
  SkillActivationMode,
  SkillTriggerType,
} from '../types';
import { getSkillsByIds } from './queries';
import { applySkillAttachmentOverrides, normalizeAttachmentTrigger } from './shared';
import { mapSkillRow } from './shared';

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

function normalizeAttachmentInputs(
  attachmentsOrSkillIds: string[] | AgentSkillAttachmentInput[],
): AgentSkillAttachmentInput[] {
  if (attachmentsOrSkillIds.length === 0) return [];

  const rawItems = attachmentsOrSkillIds as Array<string | AgentSkillAttachmentInput>;
  const normalized = rawItems.every((item): item is AgentSkillAttachmentInput => typeof item !== 'string')
    ? rawItems
    : rawItems
        .filter((item): item is string => typeof item === 'string')
        .map((skillId, index) => ({
          skillId,
          isEnabled: true,
          priority: index,
        }));

  const seen = new Set<string>();
  return normalized.filter((attachment) => {
    if (seen.has(attachment.skillId)) return false;
    seen.add(attachment.skillId);
    return true;
  });
}
