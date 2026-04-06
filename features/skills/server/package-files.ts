import type { CreateSkillFileInput, CreateSkillInput, SkillFileKind } from '../types';
import { inferSkillFileKind, guessSkillFileMediaType, normalizeReferencedPath } from './package-manifest';
import { buildSkillMarkdown } from './parser';

export type PreparedSkillFile = {
  relativePath: string;
  fileKind: SkillFileKind;
  mediaType: string | null;
  textContent: string;
  sizeBytes: number;
};

export function buildCreatedSkillFiles(data: CreateSkillInput): PreparedSkillFile[] {
  const skillMarkdown = buildSkillMarkdown(data);
  const supplementalFiles = normalizeCreatedSkillFiles(data.files ?? []);
  const generatedSkillFile: PreparedSkillFile = {
    relativePath: 'SKILL.md',
    fileKind: 'skill',
    mediaType: 'text/markdown',
    textContent: skillMarkdown,
    sizeBytes: skillMarkdown.length,
  };

  return [
    generatedSkillFile,
    ...supplementalFiles.filter((file) => file.relativePath !== 'SKILL.md'),
  ];
}

export function normalizeCreatedSkillFiles(files: CreateSkillFileInput[]): PreparedSkillFile[] {
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
    } satisfies PreparedSkillFile];
  });
}
