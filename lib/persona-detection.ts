import { generateText } from 'ai';
import { type SystemPromptKey, detectSystemPromptKey } from '@/lib/prompt';

const DETECTION_MODEL = 'google/gemini-2.5-flash-lite';

export const VALID_PERSONA_KEYS: SystemPromptKey[] = [
  'general_assistant',
  'coding_copilot',
  'product_manager',
  'friendly_tutor',
  'data_analyst',
  'summarizer_editor',
  'security_privacy_guard',
  'research_librarian',
  'translation_localization',
  'troubleshooting_debugger',
];

const SYSTEM_PROMPT = `You are a message intent classifier. Given a user message, return exactly one label that best describes its primary intent.

Labels:
- general_assistant: general questions, casual conversation, opinions, anything not fitting below
- coding_copilot: writing, reviewing, debugging, or explaining code; programming questions; CLI/API usage
- product_manager: product requirements, feature planning, roadmaps, user stories, prioritization
- friendly_tutor: learning a concept, asking for explanations from first principles, education
- data_analyst: data analysis, SQL queries, metrics, statistics, pandas/python data work
- summarizer_editor: summarizing, editing, rewriting, shortening, or improving existing text
- security_privacy_guard: security reviews, vulnerability analysis, authentication, secrets, privacy
- research_librarian: researching a topic, finding sources, literature review, fact-finding
- translation_localization: translating text, localization, language conversion
- troubleshooting_debugger: diagnosing errors, fixing bugs, stack traces, runtime issues

Rules:
- Return ONLY the label, nothing else — no punctuation, no explanation
- If ambiguous, prefer the more specific label over general_assistant`;

export async function detectPersona(prompt: string): Promise<SystemPromptKey> {
  try {
    const { text } = await generateText({
      model: DETECTION_MODEL,
      system: SYSTEM_PROMPT,
      prompt: prompt.slice(0, 500),
      maxOutputTokens: 10,
      temperature: 0,
    });

    const key = text.trim().toLowerCase() as SystemPromptKey;
    return VALID_PERSONA_KEYS.includes(key) ? key : detectSystemPromptKey(prompt);
  } catch {
    // Fall back to regex on any failure
    return detectSystemPromptKey(prompt);
  }
}
