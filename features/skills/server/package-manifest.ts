import type { SkillFileKind, SkillPackageManifest } from '../types';

export const BLOCKED_PACKAGE_ROOTS = new Set(['.git', 'node_modules']);

type PackageManifestSource = {
  repo?: string;
  repoRef?: string;
  subdirPath?: string;
};

export function normalizeReferencedPath(path: string | null | undefined): string | null {
  if (!path) return null;

  const normalizedPath = path.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (normalizedPath.length === 0 || normalizedPath.startsWith('/')) {
    return null;
  }

  const segments = normalizedPath
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  const topLevelDir = segments[0] ?? '';
  if (BLOCKED_PACKAGE_ROOTS.has(topLevelDir)) {
    return null;
  }

  return segments.join('/');
}

export function inferSkillFileKind(relativePath: string, entryFilePath = 'SKILL.md'): SkillFileKind {
  if (relativePath === entryFilePath) return 'skill';
  const topLevelDir = relativePath.split('/')[0] ?? '';
  if (topLevelDir === 'references') return 'reference';
  if (topLevelDir === 'assets') return 'asset';
  if (topLevelDir === 'scripts') return 'script';
  return 'other';
}

export function guessSkillFileMediaType(relativePath: string): string | null {
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

export function buildPackageManifest(
  files: Array<{ relativePath: string; fileKind: SkillFileKind }>,
  source?: PackageManifestSource,
): SkillPackageManifest {
  const counts = files.reduce<SkillPackageManifest['counts']>(
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
    ...(source?.repo ? { repo: source.repo } : {}),
    ...(source?.repoRef ? { repoRef: source.repoRef } : {}),
    ...(source?.subdirPath ? { subdirPath: source.subdirPath } : {}),
  };
}
