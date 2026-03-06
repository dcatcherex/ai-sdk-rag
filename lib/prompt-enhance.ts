import { generateText } from 'ai';

const ENHANCE_MODEL = 'google/gemini-2.5-flash-lite';
const ENHANCE_SYSTEM = `You are a prompt engineer. Your only job is to rewrite prompts that have enough substance to improve.

Rules:
- If the prompt is too vague, too short, or lacks enough information to improve (e.g. "help me", "what?", "explain"), return it EXACTLY as-is — do NOT add clarifying questions or filler.
- Only improve prompts that have a clear topic or task but could benefit from added specificity, constraints, or output format hints.
- Return ONLY the rewritten prompt. No explanations, no preamble, no questions.
- Keep the same intent and voice as the original.`;

// Minimum length (chars) and word count below which enhancement is skipped
const MIN_CHARS = 15;
const MIN_WORDS = 4;

export async function enhancePrompt(prompt: string, userContext: string): Promise<string> {
  const wordCount = prompt.trim().split(/\s+/).length;
  if (prompt.trim().length < MIN_CHARS || wordCount < MIN_WORDS) {
    return prompt;
  }

  try {
    const contextBlock = userContext ? `\n\nUser context:\n${userContext}` : '';
    const { text } = await generateText({
      model: ENHANCE_MODEL,
      system: ENHANCE_SYSTEM + contextBlock,
      prompt,
    });
    return text.trim() || prompt;
  } catch (error) {
    console.error('Prompt enhancement failed, using original:', error);
    return prompt;
  }
}
