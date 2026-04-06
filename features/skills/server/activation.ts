import type { Skill, SkillFile } from '../types';
import { getResolvedSkillResourcesForPrompt, getSkillFilesBySkillIds } from './resources';
import { tokenizeForSkillMatch } from './shared';

export type SkillActivationSource = 'rule' | 'model';

export type ActivatedSkill = {
  skill: Skill;
  activationSource: SkillActivationSource;
  instructionContent: string;
  instructionPath: string | null;
};

export type SkillRuntimeContext = {
  catalogBlock: string;
  activatedSkills: ActivatedSkill[];
  activeSkillsBlock: string;
  skillResourcesBlock: string;
  skillToolIds: string[];
};

export function detectTriggeredSkills(skills: Skill[], userMessage: string): Skill[] {
  const msg = userMessage.trim();
  const msgLower = msg.toLowerCase();

  return skills.filter((skill) => {
    if (skill.activationMode === 'model') return false;
    if (skill.triggerType === 'always') return true;
    if (!skill.trigger) return false;

    if (skill.triggerType === 'slash') {
      const trigger = skill.trigger.startsWith('/') ? skill.trigger : `/${skill.trigger}`;
      return msg.startsWith(trigger) || msgLower.startsWith(trigger.toLowerCase());
    }

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

  return (
    '\n\n<available_skills>\n'
    + catalogSkills
      .map((skill) => {
        const lines = [
          `<skill name="${escapeXml(skill.name)}">`,
          `<description>${escapeXml(skill.description ?? skill.promptFragment.slice(0, 120))}</description>`,
        ];

        if (skill.skillKind === 'package') {
          lines.push(`<entry_file>${escapeXml(skill.entryFilePath)}</entry_file>`);
        }

        lines.push('</skill>');
        return lines.join('\n');
      })
      .join('\n')
    + '\n</available_skills>'
  );
}

export function resolveActivatedSkills(
  skills: Skill[],
  userMessage: string,
  filesBySkillId: Record<string, SkillFile[]> = {},
): ActivatedSkill[] {
  const ruleTriggered = detectTriggeredSkills(skills, userMessage);
  const modelDiscovered = selectModelDiscoveredSkills(skills, userMessage);
  const deduped = new Map<string, ActivatedSkill>();

  for (const skill of ruleTriggered) {
    deduped.set(skill.id, buildActivatedSkill(skill, 'rule', filesBySkillId[skill.id] ?? []));
  }

  for (const skill of modelDiscovered) {
    if (!deduped.has(skill.id)) {
      deduped.set(skill.id, buildActivatedSkill(skill, 'model', filesBySkillId[skill.id] ?? []));
    }
  }

  return [...deduped.values()];
}

export function buildActiveSkillsBlock(activatedSkills: ActivatedSkill[]): string {
  if (activatedSkills.length === 0) return '';

  return (
    '\n\n<active_skills>\n'
    + activatedSkills
      .map((entry) => [
        `## Skill: ${entry.skill.name}`,
        `Activation: ${entry.activationSource}`,
        entry.instructionPath ? `Instruction file: ${entry.instructionPath}` : null,
        entry.instructionContent,
      ]
        .filter((line): line is string => Boolean(line))
        .join('\n'))
      .join('\n\n')
    + '\n</active_skills>'
  );
}

export async function resolveSkillRuntimeContext(
  skills: Skill[],
  userMessage: string,
): Promise<SkillRuntimeContext> {
  const catalogBlock = buildAvailableSkillsCatalog(skills);
  if (skills.length === 0 || userMessage.trim().length === 0) {
    return {
      catalogBlock,
      activatedSkills: [],
      activeSkillsBlock: '',
      skillResourcesBlock: '',
      skillToolIds: [],
    };
  }

  const candidateSkills = resolveActivatedSkills(skills, userMessage);
  if (candidateSkills.length === 0) {
    return {
      catalogBlock,
      activatedSkills: [],
      activeSkillsBlock: '',
      skillResourcesBlock: '',
      skillToolIds: [],
    };
  }

  const filesBySkillId = await getSkillFilesBySkillIds(candidateSkills.map((entry) => entry.skill.id));
  const activatedSkills = resolveActivatedSkills(skills, userMessage, filesBySkillId);

  return {
    catalogBlock,
    activatedSkills,
    activeSkillsBlock: buildActiveSkillsBlock(activatedSkills),
    skillResourcesBlock: getResolvedSkillResourcesForPrompt(activatedSkills, userMessage, filesBySkillId),
    skillToolIds: [...new Set(activatedSkills.flatMap((entry) => entry.skill.enabledTools))],
  };
}

function buildActivatedSkill(
  skill: Skill,
  activationSource: SkillActivationSource,
  files: SkillFile[],
): ActivatedSkill {
  const entryFile = files.find((file) => file.relativePath === skill.entryFilePath);
  const instructionContent = skill.skillKind === 'package' && entryFile?.textContent
    ? entryFile.textContent
    : skill.promptFragment;

  return {
    skill,
    activationSource,
    instructionContent,
    instructionPath: skill.skillKind === 'package' ? skill.entryFilePath : null,
  };
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

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
