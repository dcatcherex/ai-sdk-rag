import { generateText } from 'ai';
import type { ChatMessage } from '@/features/chat/types';

const SUMMARY_MODEL = 'google/gemini-2.5-flash-lite';
export const SUMMARY_THRESHOLD = 20;
const MESSAGES_TO_KEEP = 4;

const SUMMARY_SYSTEM = `You are a conversation summarizer. Compress the provided conversation into a concise factual summary.
Rules:
- Capture key topics, decisions, code, and user goals
- Preserve specific facts: file names, variable names, error messages
- Write in third-person past tense: "The user asked...", "The assistant explained..."
- Output ONLY the summary text. No preamble, no headers.
- Max 300 words.`;

export type SummaryResult = {
  summary: string;
  trimmedMessages: ChatMessage[];
};

export async function summarizeConversation(messages: ChatMessage[]): Promise<SummaryResult> {
  if (messages.length <= SUMMARY_THRESHOLD) {
    return { summary: '', trimmedMessages: messages };
  }

  const tail = messages.slice(-MESSAGES_TO_KEEP);
  const head = messages.slice(0, -MESSAGES_TO_KEEP);

  const transcript = head
    .map((m) => {
      const textPart = m.parts.find((p) => p.type === 'text');
      const text = textPart?.type === 'text' ? textPart.text.slice(0, 600) : '';
      return text ? `${m.role}: ${text}` : null;
    })
    .filter(Boolean)
    .join('\n');

  if (!transcript.trim()) return { summary: '', trimmedMessages: tail };

  try {
    const { text } = await generateText({
      model: SUMMARY_MODEL,
      system: SUMMARY_SYSTEM,
      prompt: `Conversation to summarize:\n\n${transcript}`,
    });
    return { summary: text.trim(), trimmedMessages: tail };
  } catch (error) {
    console.error('Conversation summary failed, sending full history:', error);
    return { summary: '', trimmedMessages: messages };
  }
}
