import type { CreateSkillInput, SkillTriggerType } from '../types';
import {
  dedupeSkillResponseContracts,
  normalizeRequiredSections,
  normalizeResponseContractEscalation,
  normalizeResponseFormat,
  normalizeResponseIntent,
  type SkillResponseContract,
} from '@/features/response-format/contracts';

export type ParsedSkillMarkdown = {
  name: string;
  description?: string;
  triggerType: SkillTriggerType;
  trigger?: string;
  enabledTools: string[];
  body: string;
  responseContracts: SkillResponseContract[];
};

export function buildSkillMarkdown(data: CreateSkillInput): string {
  const frontmatterLines = [
    '---',
    `name: ${data.name}`,
    `description: ${escapeFrontmatterValue(data.description)}`,
  ];

  if (data.license?.trim()) {
    frontmatterLines.push(`license: ${escapeFrontmatterValue(data.license.trim())}`);
  }

  if (data.compatibility?.trim()) {
    frontmatterLines.push(`compatibility: ${escapeFrontmatterValue(data.compatibility.trim())}`);
  }

  if (data.enabledTools && data.enabledTools.length > 0) {
    frontmatterLines.push(`allowed-tools: ${data.enabledTools.join(' ')}`);
  }

  if (data.metadata && Object.keys(data.metadata).length > 0) {
    frontmatterLines.push('metadata:');
    for (const [key, value] of Object.entries(data.metadata)) {
      frontmatterLines.push(`  ${key}: ${escapeFrontmatterValue(value)}`);
    }
  }

  frontmatterLines.push('---', '', data.promptFragment.trim());
  return frontmatterLines.join('\n').trim();
}

export function parseSkillMarkdown(content: string): ParsedSkillMarkdown {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  let frontmatter: Record<string, string> = {};
  let body = content;
  let frontmatterSource = '';

  if (fmMatch) {
    frontmatterSource = fmMatch[1] ?? '';
    frontmatter = parseSimpleYaml(frontmatterSource);
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

  // Parse allowed-tools: space-separated tool IDs (e.g. "weather record_keeper")
  const rawAllowedTools = frontmatter['allowed-tools'];
  const enabledTools = rawAllowedTools
    ? rawAllowedTools.split(/\s+/).filter(Boolean)
    : [];

  const frontmatterContracts = parseResponseContractsFromFrontmatter(frontmatterSource);
  const markdownContracts = frontmatterContracts.length === 0
    ? parseResponseContractsFromMarkdownSection(body)
    : [];

  return {
    name,
    description,
    triggerType,
    trigger,
    enabledTools,
    body,
    responseContracts: dedupeSkillResponseContracts([
      ...frontmatterContracts,
      ...markdownContracts,
    ]),
  };
}

function escapeFrontmatterValue(value: string): string {
  const trimmed = value.trim();
  const escaped = trimmed.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function parseSimpleYaml(yaml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = yaml.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const colonIdx = line.indexOf(':');

    // Skip indented lines (continuation) and lines without a colon
    if (colonIdx === -1 || line.startsWith(' ') || line.startsWith('\t')) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    i++;

    if (!key) continue;

    // Handle YAML block scalars: > (folded) and | (literal)
    if (value === '>' || value === '|-' || value === '>-' || value === '|') {
      const blockLines: string[] = [];
      const foldNewlines = value === '>' || value === '>-';

      while (i < lines.length) {
        const next = lines[i]!;
        // Continuation lines must be indented
        if (next.startsWith(' ') || next.startsWith('\t')) {
          blockLines.push(next.trim());
          i++;
        } else {
          break;
        }
      }

      value = foldNewlines ? blockLines.join(' ').replace(/\s+/g, ' ').trim() : blockLines.join('\n').trim();
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function parseResponseContractsFromFrontmatter(frontmatterSource: string): SkillResponseContract[] {
  if (!frontmatterSource.trim()) return [];

  const lines = frontmatterSource.split('\n');
  const contracts: SkillResponseContract[] = [];
  let startIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (/^response-contracts:\s*$/i.test(lines[i]?.trim() ?? '')) {
      startIndex = i + 1;
      break;
    }
  }

  if (startIndex === -1) return [];

  const items: Array<Record<string, string>> = [];
  let current: Record<string, string> | null = null;

  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (!line.trim()) continue;
    if (!/^\s+/.test(line)) break;

    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      if (current && Object.keys(current).length > 0) {
        items.push(current);
      }
      current = {};
      const inlineEntry = trimmed.slice(2).trim();
      if (inlineEntry) {
        const parsed = parseKeyValueLine(inlineEntry);
        if (parsed) current[parsed.key] = parsed.value;
      }
      continue;
    }

    if (!current) continue;
    const parsed = parseKeyValueLine(trimmed);
    if (parsed) current[parsed.key] = parsed.value;
  }

  if (current && Object.keys(current).length > 0) {
    items.push(current);
  }

  return items
    .map((item) => buildSkillResponseContract(item, 'frontmatter'))
    .filter((contract): contract is SkillResponseContract => contract !== null);
}

function parseResponseContractsFromMarkdownSection(body: string): SkillResponseContract[] {
  const lines = body.split('\n');
  const sectionStart = lines.findIndex((line) => /^##+\s+Response Contracts\s*$/i.test(line.trim()));
  if (sectionStart === -1) return [];

  const sectionLines: string[] = [];
  for (let i = sectionStart + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (/^##+\s+/.test(line.trim())) break;
    sectionLines.push(line);
  }

  const sectionBody = sectionLines.join('\n').trim();
  if (!sectionBody) return [];

  const items: Array<Record<string, string>> = [];
  let current: Record<string, string> = {};

  for (const rawLine of sectionBody.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      if (Object.keys(current).length > 0) {
        items.push(current);
        current = {};
      }
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (!bulletMatch) continue;

    const parsed = parseKeyValueLine(bulletMatch[1] ?? '');
    if (!parsed) continue;

    if (parsed.key === 'intent' && Object.keys(current).length > 0) {
      items.push(current);
      current = {};
    }

    current[parsed.key] = parsed.value;
  }

  if (Object.keys(current).length > 0) {
    items.push(current);
  }

  return items
    .map((item) => buildSkillResponseContract(item, 'markdown_section'))
    .filter((contract): contract is SkillResponseContract => contract !== null);
}

function parseKeyValueLine(input: string): { key: string; value: string } | null {
  const colonIndex = input.indexOf(':');
  if (colonIndex === -1) return null;

  const key = input.slice(0, colonIndex).trim().toLowerCase();
  const value = input.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
  if (!key || !value) return null;

  return { key, value };
}

function buildSkillResponseContract(
  values: Record<string, string>,
  source: SkillResponseContract['source'],
): SkillResponseContract | null {
  const intent = normalizeResponseIntent(values.intent);
  if (!intent) return null;

  const contract: SkillResponseContract = {
    intent,
    source,
  };

  const defaultFormat = normalizeResponseFormat(values['default-format']);
  if (defaultFormat) {
    contract.defaultFormat = defaultFormat;
  }

  if (values['card-template']) {
    contract.cardTemplate = values['card-template'].trim();
  }

  const escalation = normalizeResponseContractEscalation(values.escalation);
  if (escalation) {
    contract.escalation = escalation;
  }

  const requiredSections = normalizeRequiredSections(values['required sections']);
  if (requiredSections.length > 0) {
    contract.requiredSections = requiredSections;
  }

  return contract;
}
