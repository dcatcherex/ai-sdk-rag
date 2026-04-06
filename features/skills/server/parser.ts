import type { CreateSkillInput, SkillTriggerType } from '../types';

export type ParsedSkillMarkdown = {
  name: string;
  description?: string;
  triggerType: SkillTriggerType;
  trigger?: string;
  body: string;
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

  if (fmMatch) {
    frontmatter = parseSimpleYaml(fmMatch[1] ?? '');
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

function escapeFrontmatterValue(value: string): string {
  const trimmed = value.trim();
  const escaped = trimmed.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function parseSimpleYaml(yaml: string): Record<string, string> {
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
