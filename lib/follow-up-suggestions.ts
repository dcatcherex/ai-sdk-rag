import { generateText } from 'ai';

const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
const DEFAULT_MAX_CHARS = 60;

function buildSystemPrompt(maxChars: number, languageHint?: string): string {
  const langRule = languageHint
    ? `- Reply in ${languageHint}.\n`
    : `- Reply in the same language as the conversation.\n`;

  return `You are a conversation assistant that generates smart follow-up chips for a chat UI.

First, decide which mode applies based on the last assistant message:
- MODE "answers": the assistant is clearly waiting for the user to provide specific information (asking for a name, product, preference, etc.)
- MODE "questions": the assistant gave information, completed a task, or the conversation is open-ended.

Then generate exactly 3 short strings accordingly:
- In "answers" mode: concrete example answers the user could tap to reply (short, realistic, varied)
- In "questions" mode: follow-up questions that logically extend the conversation

Rules:
- Return ONLY a JSON object: {"mode": "answers"|"questions", "items": ["...", "...", "..."]}
- Each item must be ≤${maxChars} characters.
${langRule}- No explanations, no preamble — only the raw JSON object.
- "answers" example: {"mode":"answers","items":["คอร์สสอนทำธุรกิจออนไลน์","Summer Camp สำหรับเด็ก","บริการออกแบบ Logo"]}
- "questions" example: {"mode":"questions","items":["How does caching affect this?","Can you show an example?","What are the trade-offs?"]}`;
}

export type FollowUpMode = 'questions' | 'answers';

export type FollowUpOptions = {
  model?: string;
  maxChars?: number;
  languageHint?: string;
};

export async function generateFollowUpSuggestions(
  conversationContext: string,
  options: FollowUpOptions = {},
): Promise<string[]> {
  const model = options.model ?? DEFAULT_MODEL;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;

  try {
    const { text } = await generateText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: model as any,
      system: buildSystemPrompt(maxChars, options.languageHint),
      prompt: `Conversation so far:\n${conversationContext}\n\nGenerate the JSON object:`,
    });

    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>).items)
    ) return [];

    const items = (parsed as { items: unknown[] }).items;
    return items
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().slice(0, maxChars))
      .slice(0, 3);
  } catch (error) {
    console.error('Follow-up suggestion generation failed:', error);
    return [];
  }
}
