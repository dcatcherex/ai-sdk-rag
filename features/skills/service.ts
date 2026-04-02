import { and, eq, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { agentSkill, user } from '@/db/schema';
import type { CreateSkillInput, Skill, SkillTriggerType, SkillWithOwner, UpdateSkillInput } from './types';

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getSkills(userId: string): Promise<SkillWithOwner[]> {
  const rows = await db
    .select({
      skill: agentSkill,
      ownerName: user.name,
    })
    .from(agentSkill)
    .leftJoin(user, eq(agentSkill.userId, user.id))
    .where(or(eq(agentSkill.userId, userId), eq(agentSkill.isPublic, true)));

  // Deduplicate (own skills that happen to be public)
  const seen = new Set<string>();
  return rows
    .filter(({ skill }) => {
      if (seen.has(skill.id)) return false;
      seen.add(skill.id);
      return true;
    })
    .map(({ skill, ownerName }) => ({
      ...skill,
      triggerType: skill.triggerType as SkillTriggerType,
      ownerName: ownerName ?? undefined,
    }));
}

export async function getSkillsByIds(skillIds: string[]): Promise<Skill[]> {
  if (skillIds.length === 0) return [];
  const rows = await db
    .select()
    .from(agentSkill)
    .where(
      skillIds.length === 1
        ? eq(agentSkill.id, skillIds[0]!)
        : or(...skillIds.map((id) => eq(agentSkill.id, id)))
    );
  return rows.map((r) => ({ ...r, triggerType: r.triggerType as SkillTriggerType }));
}

export async function createSkill(userId: string, data: CreateSkillInput): Promise<Skill> {
  const now = new Date();
  const [row] = await db
    .insert(agentSkill)
    .values({
      id: nanoid(),
      userId,
      name: data.name,
      description: data.description ?? null,
      triggerType: data.triggerType,
      trigger: normaliseTrigger(data.triggerType, data.trigger),
      promptFragment: data.promptFragment,
      enabledTools: data.enabledTools ?? [],
      sourceUrl: data.sourceUrl ?? null,
      isPublic: data.isPublic ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return { ...row!, triggerType: row!.triggerType as SkillTriggerType };
}

export async function updateSkill(
  userId: string,
  skillId: string,
  data: UpdateSkillInput,
): Promise<Skill | null> {
  const [row] = await db
    .update(agentSkill)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.triggerType !== undefined && { triggerType: data.triggerType }),
      ...(data.trigger !== undefined && {
        trigger: normaliseTrigger(data.triggerType ?? 'keyword', data.trigger),
      }),
      ...(data.promptFragment !== undefined && { promptFragment: data.promptFragment }),
      ...(data.enabledTools !== undefined && { enabledTools: data.enabledTools }),
      ...(data.sourceUrl !== undefined && { sourceUrl: data.sourceUrl ?? null }),
      ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
    })
    .where(and(eq(agentSkill.id, skillId), eq(agentSkill.userId, userId)))
    .returning();
  if (!row) return null;
  return { ...row, triggerType: row.triggerType as SkillTriggerType };
}

export async function deleteSkill(userId: string, skillId: string): Promise<boolean> {
  const result = await db
    .delete(agentSkill)
    .where(and(eq(agentSkill.id, skillId), eq(agentSkill.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

/** Clone a public skill into the user's library (install from community gallery). */
export async function installSkill(userId: string, skillId: string): Promise<Skill | null> {
  const [source] = await db
    .select()
    .from(agentSkill)
    .where(and(eq(agentSkill.id, skillId), eq(agentSkill.isPublic, true)))
    .limit(1);
  if (!source) return null;

  const now = new Date();
  const [row] = await db
    .insert(agentSkill)
    .values({
      id: nanoid(),
      userId,
      name: source.name,
      description: source.description,
      triggerType: source.triggerType,
      trigger: source.trigger,
      promptFragment: source.promptFragment,
      enabledTools: source.enabledTools,
      sourceUrl: source.sourceUrl,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return { ...row!, triggerType: row!.triggerType as SkillTriggerType };
}

// ── Import from URL ───────────────────────────────────────────────────────────

/**
 * Import a skill from a GitHub URL pointing to a SKILL.md file.
 * Accepts:
 *   - https://github.com/user/repo/blob/branch/path/SKILL.md
 *   - https://raw.githubusercontent.com/user/repo/branch/path/SKILL.md
 */
export async function importSkillFromUrl(
  userId: string,
  rawUrl: string,
): Promise<Skill> {
  const fetchUrl = toRawUrl(rawUrl);
  const res = await fetch(fetchUrl, { headers: { 'User-Agent': 'ai-sdk-skill-importer' } });
  if (!res.ok) throw new Error(`Failed to fetch skill: HTTP ${res.status}`);

  const markdown = await res.text();
  const parsed = parseSkillMd(markdown);

  return createSkill(userId, {
    name: parsed.name,
    description: parsed.description ?? `Imported skill: ${parsed.name}`,
    triggerType: parsed.triggerType,
    trigger: parsed.trigger ?? undefined,
    promptFragment: parsed.body,
    enabledTools: [],
    sourceUrl: rawUrl,
    isPublic: false,
  });
}

// ── Trigger detection ─────────────────────────────────────────────────────────

/**
 * Given a list of skills and the last user message, return skills whose trigger matches.
 */
export function detectTriggeredSkills(skills: Skill[], userMessage: string): Skill[] {
  const msg = userMessage.trim();
  const msgLower = msg.toLowerCase();

  return skills.filter((skill) => {
    if (skill.triggerType === 'always') return true;
    if (!skill.trigger) return false;

    if (skill.triggerType === 'slash') {
      const t = skill.trigger.startsWith('/') ? skill.trigger : `/${skill.trigger}`;
      return msg.startsWith(t) || msg.toLowerCase().startsWith(t.toLowerCase());
    }
    // keyword
    return msgLower.includes(skill.trigger.toLowerCase());
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseTrigger(
  triggerType: SkillTriggerType | undefined,
  trigger: string | null | undefined,
): string | null {
  if (triggerType === 'always') return null;
  if (!trigger) return null;
  if (triggerType === 'slash' && !trigger.startsWith('/')) return `/${trigger}`;
  return trigger;
}

/** Convert a GitHub blob URL to a raw content URL. */
function toRawUrl(url: string): string {
  return url
    .replace('https://github.com/', 'https://raw.githubusercontent.com/')
    .replace('/blob/', '/');
}

/** Parse YAML frontmatter + body from a SKILL.md string. */
function parseSkillMd(content: string): {
  name: string;
  description?: string;
  triggerType: SkillTriggerType;
  trigger?: string;
  body: string;
} {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  let frontmatter: Record<string, string> = {};
  let body = content;

  if (fmMatch) {
    frontmatter = parseYaml(fmMatch[1]!);
    body = fmMatch[2]!.trim();
  }

  const name = frontmatter['name'] ?? 'Imported Skill';
  const description = frontmatter['description'];

  // Infer trigger type from frontmatter fields
  let triggerType: SkillTriggerType = 'always';
  let trigger: string | undefined;

  const rawTrigger = frontmatter['trigger'] ?? frontmatter['slash-command'] ?? frontmatter['keyword'];
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

/** Minimal YAML key: value parser (single-level only). */
function parseYaml(yaml: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}
