import { generateText } from 'ai';

const SUGGEST_MODEL = 'google/gemini-2.5-flash-lite';

const SUGGEST_SYSTEM = `You are a conversation assistant. Your only job is to generate follow-up questions.

Rules:
- Return ONLY a JSON array of exactly 3 strings.
- Each question must be ≤60 characters.
- Questions must be specific to the conversation, not generic.
- Make questions that logically extend the last exchange.
- No explanations, no preamble — only the raw JSON array.
- Example output: ["How does caching affect this?", "Can you show a TypeScript example?", "What are the trade-offs?"]`;

export async function generateFollowUpSuggestions(
  conversationContext: string
): Promise<string[]> {
  try {
    const { text } = await generateText({
      model: SUGGEST_MODEL,
      system: SUGGEST_SYSTEM,
      prompt: `Conversation so far:\n${conversationContext}\n\nGenerate 3 follow-up questions as a JSON array:`,
    });

    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().slice(0, 60))
      .slice(0, 3);
  } catch (error) {
    console.error('Follow-up suggestion generation failed:', error);
    return [];
  }
}
