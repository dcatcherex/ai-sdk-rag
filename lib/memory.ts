import { generateText } from 'ai';
import { db } from '@/lib/db';
import { userMemory } from '@/db/schema';
import { eq, desc, inArray, SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';

type MemoryPrefsRow = {
  memoryEnabled?: boolean | null;
  memoryInjectEnabled?: boolean | null;
  memoryExtractEnabled?: boolean | null;
};

/**
 * Derives memory flags from a userPreferences row (or null when no row exists).
 * All three flags default to true when absent, matching the web-chat route behaviour.
 * Use this in every entry point (web, LINE, compare) so behaviour is consistent.
 */
export function resolveMemoryPreferences(row: MemoryPrefsRow | null | undefined): {
  shouldInject: boolean;
  shouldExtract: boolean;
} {
  const enabled = row?.memoryEnabled ?? true;
  return {
    shouldInject: enabled && (row?.memoryInjectEnabled ?? true),
    shouldExtract: enabled && (row?.memoryExtractEnabled ?? true),
  };
}

const MEMORY_MODEL = 'google/gemini-2.5-flash-lite';

// ── Storage limit (how many facts we keep per user in the DB) ────────────────
const MAX_FACTS_PER_USER = 50;

// ── Injection budget (how many tokens we allow in the prompt block) ──────────
// Uses a 4-chars-per-token estimate — fast, no tokenizer dependency.
// 600 tokens × 4 = 2400 chars covers ~24–48 typical facts with room for the XML wrapper.
const INJECTION_MAX_CHARS = 600 * 4; // 2400
const INJECTION_MAX_FACTS_PER_CATEGORY = 8;

export type MemoryFact = { category: string; fact: string };

/**
 * Fetches the raw stored facts for a user, newest-first.
 * Retrieval and rendering are intentionally separate so callers can
 * apply different budgets or formats without re-querying the DB.
 */
export async function getUserMemoryFacts(userId: string): Promise<MemoryFact[]> {
  const rows = await db
    .select({ category: userMemory.category, fact: userMemory.fact })
    .from(userMemory)
    .where(eq(userMemory.userId, userId))
    .orderBy(desc(userMemory.createdAt))
    .limit(MAX_FACTS_PER_USER);
  return rows;
}

/**
 * Fetches facts for an unlinked LINE user, newest-first.
 * Used when the LINE user has no Vaja account (no linkedUser).
 */
export async function getLineUserMemoryFacts(lineUserId: string): Promise<MemoryFact[]> {
  const rows = await db
    .select({ category: userMemory.category, fact: userMemory.fact })
    .from(userMemory)
    .where(eq(userMemory.lineUserId, lineUserId))
    .orderBy(desc(userMemory.createdAt))
    .limit(MAX_FACTS_PER_USER);
  return rows;
}

/**
 * Renders a memory block suitable for prompt injection.
 *
 * Applies two guards before the facts reach the prompt:
 *   1. Per-category cap — prevents one category from dominating.
 *   2. Character budget — keeps the block within a token-safe size.
 *
 * Returns the XML-wrapped block, or '' when there is nothing to inject.
 */
export function renderUserMemoryBlock(
  facts: MemoryFact[],
  options: { maxChars?: number; maxFactsPerCategory?: number } = {},
): string {
  const maxChars = options.maxChars ?? INJECTION_MAX_CHARS;
  const maxPerCategory = options.maxFactsPerCategory ?? INJECTION_MAX_FACTS_PER_CATEGORY;

  const categoryCounts = new Map<string, number>();
  const selected: string[] = [];
  let usedChars = 0;

  for (const { category, fact } of facts) {
    const count = categoryCounts.get(category) ?? 0;
    if (count >= maxPerCategory) continue;

    const line = `[${category}] ${fact}`;
    if (usedChars + line.length + 1 > maxChars) break; // +1 for the newline

    selected.push(line);
    categoryCounts.set(category, count + 1);
    usedChars += line.length + 1;
  }

  if (selected.length === 0) return '';
  return `<user_context>\n${selected.join('\n')}\n</user_context>`;
}

/**
 * Convenience wrapper used by all entry points (web, LINE, compare).
 * Fetches facts and renders with the default injection budget.
 */
export async function getUserMemoryContext(userId: string): Promise<string> {
  try {
    const facts = await getUserMemoryFacts(userId);
    return renderUserMemoryBlock(facts);
  } catch (error) {
    console.error('Failed to get user memory context:', error);
    return '';
  }
}

/**
 * Convenience wrapper for unlinked LINE users.
 * Falls back to '' on error so LINE replies are never blocked.
 */
export async function getLineUserMemoryContext(lineUserId: string): Promise<string> {
  try {
    const facts = await getLineUserMemoryFacts(lineUserId);
    return renderUserMemoryBlock(facts);
  } catch (error) {
    console.error('Failed to get LINE user memory context:', error);
    return '';
  }
}

type ConversationMessage = { role: string; content?: string; parts?: Array<{ type: string; text?: string }> };

/**
 * Shared extraction logic. `ownerWhere` is the DB filter for existing facts;
 * `ownerFields` is what gets written into new rows.
 */
async function extractAndStoreMemoryInternal(
  ownerWhere: SQL,
  ownerFields: { userId?: string | null; lineUserId?: string | null },
  messages: ConversationMessage[],
  threadId: string,
  existingContext: string,
): Promise<void> {
  try {
    const conversation = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => {
        const text = m.parts
          ? m.parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join(' ')
          : (m.content ?? '');
        return `${m.role}: ${text.slice(0, 500)}`;
      })
      .join('\n');

    if (!conversation.trim()) return;

    const systemPrompt = `You are a memory extractor. From the conversation, extract NEW facts about the USER (not the assistant) that would be useful to personalize future responses.

Categories: 'preference' (tools, styles, formats they like), 'expertise' (skills, technologies they know), 'context' (their role, company, project), 'goal' (what they're trying to achieve long-term)

Rules:
- Only extract facts about the USER, not questions or generic statements
- Return ONLY facts NOT already in the existing user context
- Each fact must be concrete and specific (not vague)
- Return empty array [] if nothing new and meaningful
- Format: JSON array of {category, fact} objects
- Max 5 facts per call

Existing user context:
${existingContext || '(none yet)'}`;

    const { text } = await generateText({
      model: MEMORY_MODEL,
      system: systemPrompt,
      prompt: `Conversation:\n${conversation}\n\nExtract new user facts as JSON array:`,
    });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const facts = JSON.parse(jsonMatch[0]) as Array<{ category: string; fact: string }>;
    if (!Array.isArray(facts) || facts.length === 0) return;

    // Prune oldest if over limit
    const currentFacts = await db
      .select({ id: userMemory.id })
      .from(userMemory)
      .where(ownerWhere)
      .orderBy(desc(userMemory.createdAt));

    const overflow = currentFacts.length + facts.length - MAX_FACTS_PER_USER;
    if (overflow > 0) {
      const idsToDelete = currentFacts.slice(-overflow).map((f) => f.id);
      if (idsToDelete.length > 0) {
        await db.delete(userMemory).where(inArray(userMemory.id, idsToDelete));
      }
    }

    const validFacts = facts.filter(
      (f) => f.category && f.fact && typeof f.fact === 'string' && f.fact.length > 5
    );
    if (validFacts.length === 0) return;

    // String-based dedup
    const existingFacts = await db
      .select({ fact: userMemory.fact })
      .from(userMemory)
      .where(ownerWhere);

    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, ' ');

    const existingNorms = existingFacts.map((f) => normalize(f.fact));
    const dedupedFacts = validFacts.filter((f) => {
      const newNorm = normalize(f.fact);
      return !existingNorms.some(
        (ex) => ex === newNorm || (newNorm.length > 15 && (ex.includes(newNorm) || newNorm.includes(ex)))
      );
    });

    if (dedupedFacts.length === 0) return;

    await db.insert(userMemory).values(
      dedupedFacts.map((f) => ({
        id: nanoid(),
        ...ownerFields,
        category: f.category,
        fact: f.fact.slice(0, 500),
        sourceThreadId: threadId,
      }))
    );
  } catch (error) {
    console.error('Failed to extract/store memory:', error);
  }
}

/** Extract and store memory for a linked Vaja account user. */
export async function extractAndStoreMemory(
  userId: string,
  messages: ConversationMessage[],
  threadId: string,
  existingContext: string,
): Promise<void> {
  return extractAndStoreMemoryInternal(
    eq(userMemory.userId, userId),
    { userId },
    messages, threadId, existingContext,
  );
}

/** Extract and store memory for an unlinked LINE user (keyed by LINE user ID). */
export async function extractAndStoreLineUserMemory(
  lineUserId: string,
  messages: ConversationMessage[],
  threadId: string,
  existingContext: string,
): Promise<void> {
  return extractAndStoreMemoryInternal(
    eq(userMemory.lineUserId, lineUserId),
    { lineUserId },
    messages, threadId, existingContext,
  );
}

/**
 * Migrate memory from an unlinked LINE user to their newly linked Vaja account.
 * Called once when the user completes account linking.
 * Moves all LINE-keyed facts to the Vaja userId so they appear in web chat too.
 */
export async function mergeLineMemoryToUser(lineUserId: string, userId: string): Promise<void> {
  try {
    // Only migrate rows that are still LINE-keyed (guard against double-call)
    const unmigratedRows = await db
      .select({ id: userMemory.id })
      .from(userMemory)
      .where(eq(userMemory.lineUserId, lineUserId));

    if (unmigratedRows.length === 0) return;

    // Check if target userId already has facts — prune excess before migrating
    const existingUserFacts = await db
      .select({ id: userMemory.id })
      .from(userMemory)
      .where(eq(userMemory.userId, userId))
      .orderBy(desc(userMemory.createdAt));

    const overflow = existingUserFacts.length + unmigratedRows.length - MAX_FACTS_PER_USER;
    if (overflow > 0) {
      const idsToDelete = existingUserFacts.slice(-overflow).map((f) => f.id);
      if (idsToDelete.length > 0) {
        await db.delete(userMemory).where(inArray(userMemory.id, idsToDelete));
      }
    }

    await db
      .update(userMemory)
      .set({ userId, lineUserId: null })
      .where(eq(userMemory.lineUserId, lineUserId));
  } catch (error) {
    console.error('Failed to merge LINE user memory:', error);
  }
}

