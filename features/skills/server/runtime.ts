import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agentSkillFile } from '@/db/schema';
import type { Skill, SkillFile } from '../types';
import { mapSkillFileRow, tokenizeForSkillMatch } from './shared';

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

  return '\n\n<available_skills>\n' + catalogSkills
    .map((skill) => `- ${skill.name}: ${skill.description ?? skill.promptFragment.slice(0, 120)}`)
    .join('\n') + '\n</available_skills>';
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

function isPromptInjectableFile(file: SkillFile | null): file is SkillFile {
  if (!file?.textContent) return false;
  if (file.fileKind === 'script') return false;
  return file.fileKind === 'reference' || file.fileKind === 'asset' || file.fileKind === 'other';
}
