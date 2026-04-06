import { inArray } from 'drizzle-orm';
import type { SkillFile } from '../types';
import type { ActivatedSkill } from './activation';
import { mapSkillFileRow, tokenizeForSkillMatch } from './shared';

export async function getSkillFilesBySkillIds(skillIds: string[]): Promise<Record<string, SkillFile[]>> {
  if (skillIds.length === 0) return {};
  const [{ db }, { agentSkillFile }] = await Promise.all([
    import('@/lib/db'),
    import('@/db/schema'),
  ]);

  const fileRows = await db
    .select()
    .from(agentSkillFile)
    .where(inArray(agentSkillFile.skillId, skillIds));

  return fileRows.reduce<Record<string, SkillFile[]>>((acc, row) => {
    const file = mapSkillFileRow(row);
    (acc[file.skillId] ??= []).push(file);
    return acc;
  }, {});
}

export function getResolvedSkillResourcesForPrompt(
  activatedSkills: ActivatedSkill[],
  userMessage: string,
  filesBySkillId: Record<string, SkillFile[]>,
): string {
  if (activatedSkills.length === 0) return '';

  const messageTokens = tokenizeForSkillMatch(userMessage);
  const sections = activatedSkills
    .map((entry) => {
      const skillFiles = filesBySkillId[entry.skill.id] ?? [];
      const explicitlyReferencedFiles = resolveExplicitlyReferencedFiles(entry, skillFiles);
      const relevantFiles = explicitlyReferencedFiles.length > 0
        ? explicitlyReferencedFiles.slice(0, 3)
        : selectRelevantReferenceFiles(skillFiles, messageTokens);

      if (relevantFiles.length === 0) return null;

      return `## Skill: ${entry.skill.name}\n`
        + relevantFiles
          .map((file) => `### ${file.relativePath}\n${file.textContent}`)
          .join('\n\n');
    })
    .filter((section): section is string => Boolean(section));

  if (sections.length === 0) return '';
  return '\n\n<skill_resources>\n' + sections.join('\n\n') + '\n</skill_resources>';
}

function resolveExplicitlyReferencedFiles(entry: ActivatedSkill, files: SkillFile[]): SkillFile[] {
  return files
    .filter((file) => file.relativePath !== entry.skill.entryFilePath)
    .filter((file) => entry.instructionContent.includes(file.relativePath))
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
