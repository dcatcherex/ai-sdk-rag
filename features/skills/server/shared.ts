import { agentSkill, agentSkillAttachment, agentSkillFile, skillSource } from '@/db/schema';
import type {
  CatalogScope,
  CatalogStatus,
  CloneBehavior,
  Skill,
  SkillActivationMode,
  SkillFile,
  SkillSource,
  SkillTriggerType,
  UpdatePolicy,
} from '../types';

export function normaliseTrigger(
  triggerType: SkillTriggerType | undefined,
  trigger: string | null | undefined,
): string | null {
  if (triggerType === undefined) return trigger ?? null;
  if (triggerType === 'always') return null;
  if (!trigger) return null;
  if (triggerType === 'slash' && !trigger.startsWith('/')) return `/${trigger}`;
  return trigger;
}

export function tokenizeForSkillMatch(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  );
}

export function mapSkillRow(row: typeof agentSkill.$inferSelect): Skill {
  return {
    ...row,
    triggerType: row.triggerType as SkillTriggerType,
    skillKind: row.skillKind as Skill['skillKind'],
    activationMode: row.activationMode as Skill['activationMode'],
    syncStatus: row.syncStatus as Skill['syncStatus'],
    catalogScope: row.catalogScope as CatalogScope,
    catalogStatus: row.catalogStatus as CatalogStatus,
    cloneBehavior: row.cloneBehavior as CloneBehavior,
    updatePolicy: row.updatePolicy as UpdatePolicy,
    packageManifest: (row.packageManifest ?? null) as Skill['packageManifest'],
  };
}

export function mapSkillFileRow(row: typeof agentSkillFile.$inferSelect): SkillFile {
  return {
    ...row,
    fileKind: row.fileKind as SkillFile['fileKind'],
  };
}

export function mapSkillSourceRow(row: typeof skillSource.$inferSelect): SkillSource {
  return row;
}

export function applySkillAttachmentOverrides(
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

export function normalizeAttachmentTrigger(trigger: string | null | undefined): string | null {
  if (trigger === undefined) return null;
  if (trigger === null) return null;
  const trimmed = trigger.trim();
  return trimmed.length > 0 ? trimmed : null;
}
