import { createHash } from 'node:crypto';

export type SkillTriggerType = 'slash' | 'keyword' | 'always';
export type SkillFileKind = 'skill' | 'reference' | 'asset' | 'script' | 'other';

type GitHubContentResponse = GitHubContentItem | GitHubContentItem[];

type GitHubContentItem = {
  type: 'file' | 'dir';
  name: string;
  path: string;
  size?: number;
  download_url: string | null;
};

type ParsedSkillMd = {
  name: string;
  description?: string;
  triggerType: SkillTriggerType;
  trigger?: string;
  body: string;
};

type GitHubSkillSource = {
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
  parsed: ParsedSkillMd;
  manifest: Record<string, unknown>;
};

const GITHUB_API_BASE = 'https://api.github.com';
const RAW_GITHUB_HOST = 'raw.githubusercontent.com';
const GITHUB_HOST = 'github.com';
const ALLOWED_TOP_LEVEL_DIRS = new Set(['references', 'assets', 'scripts']);
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
  const files = await fetchSkillPackageFiles(source);
  const skillFile = files.find((file) => file.relativePath === source.entryFilePath);

  if (!skillFile?.textContent) {
    throw new Error(`Could not load ${source.entryFilePath} from the selected skill package`);
  }

  const parsed = parseSkillMd(skillFile.textContent);
  const manifest = buildManifest(files, source);

  return {
    source,
    files,
    parsed,
    manifest,
  };
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
  const relevantFiles = discoveredFiles.filter((file) => shouldIncludePath(relativePathFromSource(source, file.path), source.entryFilePath));

  if (relevantFiles.length === 0) {
    throw new Error('No supported skill files found in the selected directory');
  }

  if (relevantFiles.length > MAX_FILE_COUNT) {
    throw new Error(`Skill package exceeds the supported file limit of ${MAX_FILE_COUNT}`);
  }

  const files = await Promise.all(
    relevantFiles.map(async (file) => {
      const relativePath = relativePathFromSource(source, file.path);
      const fileKind = inferFileKind(relativePath, source.entryFilePath);
      const mediaType = guessMediaType(relativePath);
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
    if (!isSafeRelativePath(relativePath)) {
      continue;
    }

    if (entry.type === 'file') {
      files.push(entry);
      continue;
    }

    const topLevelDir = relativePath.split('/')[0] ?? '';
    if (!ALLOWED_TOP_LEVEL_DIRS.has(topLevelDir)) {
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

function shouldIncludePath(relativePath: string, entryFilePath: string): boolean {
  if (!isSafeRelativePath(relativePath)) {
    return false;
  }

  if (relativePath === entryFilePath) {
    return true;
  }

  const topLevelDir = relativePath.split('/')[0] ?? '';
  return ALLOWED_TOP_LEVEL_DIRS.has(topLevelDir);
}

function inferFileKind(relativePath: string, entryFilePath: string): SkillFileKind {
  if (relativePath === entryFilePath) return 'skill';
  const topLevelDir = relativePath.split('/')[0] ?? '';
  if (topLevelDir === 'references') return 'reference';
  if (topLevelDir === 'assets') return 'asset';
  if (topLevelDir === 'scripts') return 'script';
  return 'other';
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

function guessMediaType(relativePath: string): string | null {
  const extension = relativePath.split('.').pop()?.toLowerCase() ?? '';

  switch (extension) {
    case 'md':
    case 'mdx':
      return 'text/markdown';
    case 'txt':
      return 'text/plain';
    case 'json':
      return 'application/json';
    case 'yaml':
    case 'yml':
      return 'application/yaml';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'text/javascript';
    case 'ts':
    case 'tsx':
      return 'text/typescript';
    case 'jsx':
      return 'text/jsx';
    case 'html':
      return 'text/html';
    case 'css':
    case 'scss':
      return 'text/css';
    case 'py':
      return 'text/x-python';
    case 'sh':
      return 'application/x-sh';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    default:
      return null;
  }
}

function isSafeRelativePath(relativePath: string): boolean {
  return relativePath.length > 0 && !relativePath.startsWith('/') && !relativePath.includes('..');
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildManifest(files: ImportedSkillFile[], source: GitHubSkillSource): Record<string, unknown> {
  const counts = files.reduce(
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
    repo: `${source.repoOwner}/${source.repoName}`,
    repoRef: source.repoRef,
    subdirPath: source.subdirPath,
    counts,
  };
}

function parseSkillMd(content: string): ParsedSkillMd {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  let frontmatter: Record<string, string> = {};
  let body = content;

  if (fmMatch) {
    frontmatter = parseYaml(fmMatch[1] ?? '');
    body = (fmMatch[2] ?? '').trim();
  }

  const name = frontmatter.name ?? 'Imported Skill';
  const description = frontmatter.description;
  let triggerType: SkillTriggerType = 'always';
  let trigger: string | undefined;

  const rawTrigger = frontmatter.trigger ?? frontmatter['slash-command'] ?? frontmatter.keyword;
  if (rawTrigger) {
    if (rawTrigger.startsWith('/')) {
      triggerType = 'slash';
      trigger = rawTrigger;
    } else {
      triggerType = 'keyword';
      trigger = rawTrigger;
    }
  }

  return { name, description, triggerType, trigger, body };
}

function parseYaml(yaml: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}
