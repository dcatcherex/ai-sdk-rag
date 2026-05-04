import type { Skill, SkillFile } from '../types';
import type { SkillResponseContract } from '@/features/response-format/contracts';
import { getResolvedSkillResourcesForPrompt, getSkillFilesBySkillIds } from './resources';
import { parseSkillMarkdown } from './parser';

export type SkillActivationSource = 'rule' | 'model';

export type ActivatedSkill = {
  skill: Skill;
  activationSource: SkillActivationSource;
  instructionContent: string;
  instructionPath: string | null;
  responseContracts: SkillResponseContract[];
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

  // Gap 3: removed activationMode === 'model' guard — all skills with a rule trigger are checked
  const triggered = skills.filter((skill) => {
    if (skill.triggerType === 'always') return true;
    if (!skill.trigger) return false;

    if (skill.triggerType === 'slash') {
      // Gap 2: match /command anywhere in message (not just at start), Thai-aware word boundary
      const trigger = (skill.trigger.startsWith('/') ? skill.trigger : `/${skill.trigger}`).toLowerCase();
      const pattern = new RegExp(
        `(?:^|[\\s\\u0E00-\\u0E7F])${escapeRegex(trigger)}(?=[\\s\\u0E00-\\u0E7F]|$)`,
        'i',
      );
      return pattern.test(msg);
    }

    return msgLower.includes(skill.trigger.toLowerCase());
  });

  // Gap 8: log slash trigger collisions so operators can detect config issues
  const seen = new Map<string, string>();
  for (const skill of triggered) {
    if (skill.triggerType === 'slash') {
      const key = skill.trigger?.toLowerCase() ?? '';
      if (seen.has(key)) {
        console.warn(
          `[skills] Slash trigger collision: "${key}" matches both "${seen.get(key)}" and "${skill.name}". Both will activate.`,
        );
      } else {
        seen.set(key, skill.name);
      }
    }
  }

  return triggered;
}

export function buildAvailableSkillsCatalog(skills: Skill[]): string {
  // Gap 3: filter by discoveryMode instead of activationMode
  const catalogSkills = skills.filter((skill) => skill.discoveryMode === 'catalog');
  if (catalogSkills.length === 0) return '';

  return (
    '\n\n<available_skills>\n'
    + catalogSkills
      .map((skill) => {
        // Gap 4: enforce token budget — never use promptFragment in catalog
        const catalogDescription = (skill.description ?? skill.name).slice(0, 200);
        const lines = [
          `<skill name="${escapeXml(skill.name)}">`,
          `<description>${escapeXml(catalogDescription)}</description>`,
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

// Rule-only activation — does not run LLM discovery.
// For full activation including LLM discovery, use resolveSkillRuntimeContext().
export function resolveActivatedSkills(
  skills: Skill[],
  userMessage: string,
  filesBySkillId: Record<string, SkillFile[]> = {},
): ActivatedSkill[] {
  const ruleTriggered = detectTriggeredSkills(skills, userMessage);
  const deduped = new Map<string, ActivatedSkill>();

  for (const skill of ruleTriggered) {
    deduped.set(skill.id, buildActivatedSkill(skill, 'rule', filesBySkillId[skill.id] ?? []));
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

  // Gap 1: rule-triggered skills (sync) + LLM-discovered catalog skills (async)
  const ruleTriggered = detectTriggeredSkills(skills, userMessage);
  const catalogSkills = skills.filter((s) => s.discoveryMode === 'catalog');
  const { runLlmSkillDiscovery } = await import('./llm-discovery');
  const modelDiscovered = await runLlmSkillDiscovery(catalogSkills, userMessage);

  // Deduplicate: rule takes priority over model when the same skill is selected by both
  const deduped = new Map<string, { skill: Skill; source: SkillActivationSource }>();
  for (const skill of ruleTriggered) {
    deduped.set(skill.id, { skill, source: 'rule' });
  }
  for (const skill of modelDiscovered) {
    if (!deduped.has(skill.id)) {
      deduped.set(skill.id, { skill, source: 'model' });
    }
  }

  if (deduped.size === 0) {
    return {
      catalogBlock,
      activatedSkills: [],
      activeSkillsBlock: '',
      skillResourcesBlock: '',
      skillToolIds: [],
    };
  }

  const selectedEntries = [...deduped.values()];
  const filesBySkillId = await getSkillFilesBySkillIds(selectedEntries.map((e) => e.skill.id));
  const activatedSkills = selectedEntries.map(({ skill, source }) =>
    buildActivatedSkill(skill, source, filesBySkillId[skill.id] ?? []),
  );

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
  const baseContent = skill.skillKind === 'package' && entryFile?.textContent
    ? entryFile.textContent
    : skill.promptFragment;

  // Gap 6 Phase A: surface bundled scripts so the LLM can reference or invoke them
  const scriptFiles = files.filter((f) => f.fileKind === 'script' && f.textContent);
  const scriptBlock = scriptFiles.length > 0
    ? '\n\n**Bundled scripts** (reference for code interpreter or tool calls):\n'
      + scriptFiles.map((f) => `\`\`\`\n# ${f.relativePath}\n${f.textContent}\n\`\`\``).join('\n')
    : '';

  return {
    skill,
    activationSource,
    instructionContent: baseContent + scriptBlock,
    instructionPath: skill.skillKind === 'package' ? skill.entryFilePath : null,
    responseContracts: resolveSkillResponseContracts(skill, entryFile?.textContent),
  };
}

function resolveSkillResponseContracts(
  skill: Skill,
  entryFileContent?: string | null,
): SkillResponseContract[] {
  if (skill.skillKind === 'package' && entryFileContent) {
    return parseSkillMarkdown(entryFileContent).responseContracts;
  }

  return parseSkillMarkdown(skill.promptFragment).responseContracts;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
