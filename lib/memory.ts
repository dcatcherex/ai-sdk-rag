import { generateText } from 'ai';
import { db } from '@/lib/db';
import { userMemory } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const MEMORY_MODEL = 'google/gemini-2.5-flash-lite';
const MAX_FACTS_PER_USER = 50;

export async function getUserMemoryContext(userId: string): Promise<string> {
  try {
    const facts = await db
      .select({ category: userMemory.category, fact: userMemory.fact })
      .from(userMemory)
      .where(eq(userMemory.userId, userId))
      .orderBy(desc(userMemory.createdAt))
      .limit(MAX_FACTS_PER_USER);

    if (facts.length === 0) return '';

    const lines = facts.map((f) => `[${f.category}] ${f.fact}`).join('\n');
    return `<user_context>\n${lines}\n</user_context>`;
  } catch (error) {
    console.error('Failed to get user memory context:', error);
    return '';
  }
}

type ConversationMessage = { role: string; content?: string; parts?: Array<{ type: string; text?: string }> };

export async function extractAndStoreMemory(
  userId: string,
  messages: ConversationMessage[],
  threadId: string,
  existingContext: string,
): Promise<void> {
  try {
    const conversation = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10) // last 10 messages for context
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

    // Check current count and prune oldest if needed
    const currentFacts = await db
      .select({ id: userMemory.id })
      .from(userMemory)
      .where(eq(userMemory.userId, userId))
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

    await db.insert(userMemory).values(
      validFacts.map((f) => ({
        id: nanoid(),
        userId,
        category: f.category,
        fact: f.fact.slice(0, 500),
        sourceThreadId: threadId,
      }))
    );
  } catch (error) {
    console.error('Failed to extract/store memory:', error);
  }
}
