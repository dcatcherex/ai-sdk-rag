import { generateText } from 'ai';

const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
const DEFAULT_MAX_CHARS = 60;

function buildSystemPrompt(maxChars: number, languageHint?: string): string {
  const langRule = languageHint
    ? `- Reply in ${languageHint}.\n`
    : `- Reply in the same language as the conversation.\n`;

  return `You generate smart follow-up chips for a chat UI.

The chips will be tapped by the end user and sent as the user's next message.
Every item must be written from the USER'S perspective.
Never write from the assistant's perspective.

First, decide which mode applies based on the last assistant message:
- MODE "answers": the assistant is clearly waiting for the user to provide specific information
- MODE "questions": the assistant gave information, completed a task, or the conversation is open-ended

Then generate exactly 3 short strings accordingly:
- In "answers" mode: concrete example answers the user could tap to reply
- In "questions" mode: short next messages the user could send to continue naturally
- If the assistant's latest message ends with a specific question, make the chips direct answers to that question.
- If the question offers choices, mirror those choices as user answers.

Rules:
- Return ONLY a JSON object: {"mode": "answers"|"questions", "items": ["...", "...", "..."]}
- Each item must be <=${maxChars} characters.
${langRule}- No explanations, no preamble, only raw JSON.
- Each item must sound like a user message, request, answer, or follow-up.
- Avoid generic acknowledgement chips like "yes", "got it", or "thanks" unless the latest question is strictly yes/no.
- Never output assistant offers/prompts such as:
  - "How can I help?"
  - "Do you want...?"
  - "Any other questions?"
- Good answers example: {"mode":"answers","items":["Chiang Mai","Red chili","Log only the costs"]}
- Good questions example: {"mode":"questions","items":["Show last month's summary","Help me log today's cost","What should I do next?"]}`;
}

export type FollowUpMode = 'questions' | 'answers';

export type FollowUpOptions = {
  model?: string;
  maxChars?: number;
  languageHint?: string;
  domainHint?: string;
  skillHints?: string[];
  latestAssistantQuestion?: string;
};

function buildOptionalGuidance(options: FollowUpOptions): string {
  const lines: string[] = [];

  if (options.latestAssistantQuestion?.trim()) {
    lines.push(`- The assistant's latest question is: ${options.latestAssistantQuestion.trim()}`);
    lines.push('- Prefer answer chips for that exact question over generic acknowledgements.');
  }

  if (options.domainHint?.trim()) {
    lines.push(`- Active profession/domain: ${options.domainHint.trim()}.`);
    lines.push('- When relevant, make the suggestions feel natural for that profession.');
  }

  const skillHints = options.skillHints
    ?.map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, 4);

  if (skillHints && skillHints.length > 0) {
    lines.push(`- Active skills/topics: ${skillHints.join(', ')}.`);
    lines.push('- If helpful, align the suggestions to those active skills/topics.');
  }

  return lines.length > 0 ? `\n${lines.join('\n')}` : '';
}

function isAssistantPerspectiveSuggestion(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return [
    /^how can i help\b/,
    /^do you want\b/,
    /^any other questions\b/,
    /^need .*help\b/,
    /^let me know\b/,
    /^would you like\b/,
  ].some((pattern) => pattern.test(normalized));
}

function isLowValueAcknowledgement(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return [
    /^yes$/,
    /^ok(?:ay)?$/,
    /^thanks?$/,
    /^thank you$/,
    /^got it$/,
    /^understood$/,
    /^ใช่(?:ครับ|ค่ะ|คะ)?$/,
    /^โอเค(?:ครับ|ค่ะ|คะ)?$/,
    /^เข้าใจแล้ว(?:ครับ|ค่ะ|คะ)?$/,
    /^ขอบคุณ(?:ครับ|ค่ะ|คะ)?$/,
  ].some((pattern) => pattern.test(normalized));
}

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
      system: buildSystemPrompt(maxChars, options.languageHint) + buildOptionalGuidance(options),
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
      .filter((item) => !isAssistantPerspectiveSuggestion(item))
      .filter((item) => !options.latestAssistantQuestion?.trim() || !isLowValueAcknowledgement(item))
      .slice(0, 3);
  } catch (error) {
    console.error('Follow-up suggestion generation failed:', error);
    return [];
  }
}
