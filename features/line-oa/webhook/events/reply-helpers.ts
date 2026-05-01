import type { ResponseQuickReply } from '@/features/response-format';

export type ConversationHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function buildSuggestionQuickReplies(suggestions: string[]): ResponseQuickReply[] {
  return suggestions
    .filter((suggestion) => suggestion.trim().length > 0)
    .slice(0, 3)
    .map((suggestion) => ({
      actionType: 'message',
      label: suggestion,
      text: suggestion,
    }));
}
