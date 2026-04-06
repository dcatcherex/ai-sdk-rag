import { createHash } from 'node:crypto';
import type { SkillFileKind, SkillPackageManifest, SkillTriggerType } from '../types';
import { buildPackageManifest, guessSkillFileMediaType, inferSkillFileKind, normalizeReferencedPath } from './package-manifest';
import { parseSkillMarkdown } from './parser';

type GitHubContentResponse = GitHubContentItem | GitHubContentItem[];

type GitHubContentItem = {
  type: 'file' | 'dir';
  name: string;
  path: string;
  size?: number;
  download_url: string | null;
};

export type GitHubSkillSource = {
  sourceType: 'github_subdir' | 'github_file';
  canonicalUrl: string;
  sourceUrl: string;
  repoOwner: string;
  repoName: string;
  repoRef: string;
  subdirPath: string;
  entryFilePath: string;
};

export type ImportedSkillFile = {
  relativePath: string;
  fileKind: SkillFileKind;
  mediaType: string | null;
  textContent: string | null;
  sizeBytes: number | null;
  checksum: string | null;
};

export type ImportedSkillPackage = {
  source: GitHubSkillSource;
  files: ImportedSkillFile[];
  parsed: ReturnType<typeof parseSkillMarkdown>;
  manifest: SkillPackageManifest;
};

const GITHUB_API_BASE = 'https://api.github.com';
const RAW_GITHUB_HOST = 'raw.githubusercontent.com';
const GITHUB_HOST = 'github.com';
const IGNORED_TOP_LEVEL_DIRS = new Set(['.git', 'node_modules']);
const MAX_FILE_COUNT = 50;
const MAX_TEXT_FILE_BYTES = 128 * 1024;
const TEXT_FILE_EXTENSIONS = new Set([
  'md',
  'mdx',
  'txt',
  'json',
  'yaml',
  'yml',
  'js',
  'ts',
  'tsx',
  'jsx',
  'mjs',
  'cjs',
  'html',
  'css',
  'scss',
  'py',
  'sh',
]);

export async function loadSkillPackageFromUrl(url: string): Promise<ImportedSkillPackage> {
  const source = parseGitHubSkillUrl(url);
  return loadSkillPackageFromSource(source);
}

export async function loadSkillPackageFromSource(source: GitHubSkillSource): Promise<ImportedSkillPackage> {
  const files = await fetchSkillPackageFiles(source);
  const skillFile = files.find((file) => file.relativePath === source.entryFilePath);

  if (!skillFile?.textContent) {
    throw new Error(`Could not load ${source.entryFilePath} from the selected skill package`);
  }

  const parsed = parseSkillMarkdown(skillFile.textContent);
  const manifest = buildPackageManifest(files, {
    repo: `${source.repoOwner}/${source.repoName}`,
    repoRef: source.repoRef,
    subdirPath: source.subdirPath,
  });

  return {
    source,
    files,
    parsed,
    manifest,
  };
}

export function buildGitHubSkillSourceFromStoredSource(source: {
  sourceType: string;
  canonicalUrl: string;
  repoOwner: string | null;
  repoName: string | null;
  repoRef: string | null;
  subdirPath: string | null;
  defaultEntryPath: string;
}): GitHubSkillSource {
  if (!source.repoOwner || !source.repoName || !source.repoRef) {
    throw new Error('Stored skill source is missing GitHub repository metadata');
  }

  if (source.sourceType !== 'github_subdir' && source.sourceType !== 'github_file') {
    throw new Error('Only GitHub-backed package skills currently support sync');
  }

  return {
    sourceType: source.sourceType as GitHubSkillSource['sourceType'],
    canonicalUrl: source.canonicalUrl,
    sourceUrl: source.canonicalUrl,
    repoOwner: source.repoOwner,
    repoName: source.repoName,
    repoRef: source.repoRef,
    subdirPath: source.subdirPath ?? '',
    entryFilePath: source.defaultEntryPath,
  };
}

export async function fetchLatestGitHubCommitSha(source: Pick<GitHubSkillSource, 'repoOwner' | 'repoName' | 'repoRef' | 'subdirPath'>): Promise<string | null> {
  const path = source.subdirPath?.trim() ?? '';
  const apiPath = `/repos/${source.repoOwner}/${source.repoName}/commits?sha=${encodeURIComponent(source.repoRef)}&per_page=1${path ? `&path=${encodeURIComponent(path)}` : ''}`;
  const res = await fetch(`${GITHUB_API_BASE}${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ai-sdk-skill-importer',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to inspect GitHub commit metadata: HTTP ${res.status}`);
  }

  const commits = (await res.json()) as Array<{ sha?: string }>;
  return commits[0]?.sha ?? null;
}

function parseGitHubSkillUrl(url: string): GitHubSkillSource {
  const parsed = new URL(url);

  if (parsed.hostname === RAW_GITHUB_HOST) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 5) {
      throw new Error('Unsupported raw GitHub skill URL');
    }

    const [repoOwner, repoName, repoRef, ...pathParts] = segments;
    const entryFilePath = pathParts[pathParts.length - 1] ?? 'SKILL.md';
    const subdirPath = pathParts.slice(0, -1).join('/');

    return {
      sourceType: 'github_file',
      canonicalUrl: `https://${GITHUB_HOST}/${repoOwner}/${repoName}/tree/${repoRef}/${subdirPath}`,
      sourceUrl: url,
      repoOwner,
      repoName,
      repoRef,
      subdirPath,
      entryFilePath,
    };
  }

  if (parsed.hostname !== GITHUB_HOST) {
    throw new Error('Only GitHub URLs are currently supported');
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 4) {
    throw new Error('Unsupported GitHub skill URL');
  }

  const [repoOwner, repoName, mode, repoRef, ...rest] = segments;

  if (mode === 'tree') {
    return {
      sourceType: 'github_subdir',
      canonicalUrl: `https://${GITHUB_HOST}/${repoOwner}/${repoName}/tree/${repoRef}/${rest.join('/')}`,
      sourceUrl: url,
      repoOwner,
      repoName,
      repoRef,
      subdirPath: rest.join('/'),
      entryFilePath: 'SKILL.md',
    };
  }

  if (mode === 'blob') {
    const entryFilePath = rest[rest.length - 1] ?? 'SKILL.md';
    const subdirPath = rest.slice(0, -1).join('/');

    return {
      sourceType: 'github_file',
      canonicalUrl: `https://${GITHUB_HOST}/${repoOwner}/${repoName}/tree/${repoRef}/${subdirPath}`,
      sourceUrl: url,
      repoOwner,
      repoName,
      repoRef,
      subdirPath,
      entryFilePath,
    };
  }

  throw new Error('Only GitHub tree and blob URLs are supported');
}

async function fetchSkillPackageFiles(source: GitHubSkillSource): Promise<ImportedSkillFile[]> {
  const discoveredFiles = await collectDirectoryFiles(source, source.subdirPath);
  const relevantFiles = discoveredFiles.filter((file) => shouldIncludePath(relativePathFromSource(source, file.path)));

  if (relevantFiles.length === 0) {
    throw new Error('No supported skill files found in the selected directory');
  }

  if (relevantFiles.length > MAX_FILE_COUNT) {
    throw new Error(`Skill package exceeds the supported file limit of ${MAX_FILE_COUNT}`);
  }

  const files = await Promise.all(
    relevantFiles.map(async (file) => {
      const relativePath = relativePathFromSource(source, file.path);
      const fileKind = inferSkillFileKind(relativePath, source.entryFilePath);
      const mediaType = guessSkillFileMediaType(relativePath);
      const shouldInline = shouldInlineText(relativePath, file.size ?? null);
      let textContent: string | null = null;
      let checksum: string | null = null;

      if (shouldInline && file.download_url) {
        const res = await fetch(file.download_url, { headers: { 'User-Agent': 'ai-sdk-skill-importer' } });
        if (!res.ok) {
          throw new Error(`Failed to fetch skill file ${relativePath}: HTTP ${res.status}`);
        }
        textContent = await res.text();
        checksum = createHash('sha256').update(textContent).digest('hex');
      }

      return {
        relativePath,
        fileKind,
        mediaType,
        textContent,
        sizeBytes: file.size ?? null,
        checksum,
      } satisfies ImportedSkillFile;
    }),
  );

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

async function collectDirectoryFiles(source: GitHubSkillSource, directoryPath: string): Promise<GitHubContentItem[]> {
  const entries = await fetchGitHubContents(source, directoryPath);
  const files: GitHubContentItem[] = [];

  for (const entry of entries) {
    const relativePath = relativePathFromSource(source, entry.path);
    if (!normalizeReferencedPath(relativePath)) {
      continue;
    }

    if (entry.type === 'file') {
      files.push(entry);
      continue;
    }

    const topLevelDir = relativePath.split('/')[0] ?? '';
    if (IGNORED_TOP_LEVEL_DIRS.has(topLevelDir)) {
      continue;
    }

    const nestedFiles = await collectDirectoryFiles(source, entry.path);
    files.push(...nestedFiles);
  }

  return files;
}

async function fetchGitHubContents(source: GitHubSkillSource, path: string): Promise<GitHubContentItem[]> {
  const apiPath = path ? `/repos/${source.repoOwner}/${source.repoName}/contents/${encodePath(path)}?ref=${encodeURIComponent(source.repoRef)}` : `/repos/${source.repoOwner}/${source.repoName}/contents?ref=${encodeURIComponent(source.repoRef)}`;
  const res = await fetch(`${GITHUB_API_BASE}${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ai-sdk-skill-importer',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to inspect GitHub skill directory: HTTP ${res.status}`);
  }

  const data = (await res.json()) as GitHubContentResponse;
  return Array.isArray(data) ? data : [data];
}

function relativePathFromSource(source: GitHubSkillSource, absolutePath: string): string {
  if (!source.subdirPath) {
    return absolutePath;
  }
  return absolutePath.startsWith(`${source.subdirPath}/`)
    ? absolutePath.slice(source.subdirPath.length + 1)
    : absolutePath;
}

function shouldIncludePath(relativePath: string): boolean {
  if (!normalizeReferencedPath(relativePath)) {
    return false;
  }

  const topLevelDir = relativePath.split('/')[0] ?? '';
  if (IGNORED_TOP_LEVEL_DIRS.has(topLevelDir)) {
    return false;
  }

  return true;
}

function shouldInlineText(relativePath: string, sizeBytes: number | null): boolean {
  const extension = relativePath.split('.').pop()?.toLowerCase() ?? '';
  if (!TEXT_FILE_EXTENSIONS.has(extension)) {
    return false;
  }
  if (sizeBytes !== null && sizeBytes > MAX_TEXT_FILE_BYTES) {
    return false;
  }
  return true;
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}
