import { generateFollowUpSuggestions } from '@/lib/follow-up-suggestions';
import { buildResponseAuditSummary, buildResponsePlan } from '@/features/response-format';
import type { ChatMessage, ChatMessageMetadata } from '@/features/chat/types';
import type { ResponseAuditSummary } from '@/features/response-format/server/audit';

type PrepareTextMessagesOptions = {
  messages: ChatMessage[];
  lastUserPrompt: string | null | undefined;
  followUpSuggestionsEnabled: boolean;
  generateSuggestions?: (context: string) => Promise<string[]>;
};

type PrepareTextMessagesResult = {
  messages: ChatMessage[];
  responseAudit: ResponseAuditSummary | null;
};

export async function prepareTextMessagesForFinalization({
  messages,
  lastUserPrompt,
  followUpSuggestionsEnabled,
  generateSuggestions = generateFollowUpSuggestions,
}: PrepareTextMessagesOptions): Promise<PrepareTextMessagesResult> {
  const lastAssistantIdx = messages.map((message) => message.role).lastIndexOf('assistant');
  let messagesWithSuggestions = messages;

  if (lastAssistantIdx !== -1 && followUpSuggestionsEnabled) {
    const contextStr = messages
      .slice(-6)
      .map((message) => {
        const textPart = message.parts.find((part) => part.type === 'text');
        const text = textPart?.type === 'text' ? textPart.text.slice(0, 400) : '';
        return `${message.role}: ${text}`;
      })
      .filter((line) => !line.endsWith(': '))
      .join('\n');

    const suggestions = await generateSuggestions(contextStr);
    if (suggestions.length > 0) {
      messagesWithSuggestions = messages.map((message, index) =>
        index === lastAssistantIdx
          ? {
              ...message,
              metadata: {
                ...(message.metadata ?? {}),
                followUpSuggestions: suggestions,
              },
            }
          : message,
      );
    }
  }

  const lastAssistantText = getLastAssistantText(messagesWithSuggestions);
  const responsePlan = lastAssistantText
    ? buildResponsePlan({
        text: lastAssistantText,
        userText: lastUserPrompt ?? '',
        locale: inferFinalizationLocale(lastAssistantText, lastUserPrompt ?? ''),
        quickReplies: normalizeSuggestionQuickReplies(
          ((messagesWithSuggestions[lastAssistantIdx]?.metadata as ChatMessageMetadata | undefined)?.followUpSuggestions) ?? [],
        ),
      })
    : null;
  const responseAudit = responsePlan ? buildResponseAuditSummary(responsePlan) : null;

  if (responseAudit && lastAssistantIdx !== -1) {
    messagesWithSuggestions = messagesWithSuggestions.map((message, index) =>
      index === lastAssistantIdx
        ? { ...message, metadata: { ...(message.metadata ?? {}), responseFormat: responseAudit } }
        : message,
    );
  }

  return {
    messages: messagesWithSuggestions,
    responseAudit,
  };
}

export function buildImageResponseAudit(message: string, userText: string | null | undefined): ResponseAuditSummary {
  return buildResponseAuditSummary(
    buildResponsePlan({
      text: message,
      userText: userText ?? '',
      locale: inferFinalizationLocale(message, userText ?? ''),
    }),
  );
}

export function inferFinalizationLocale(...candidates: string[]): string {
  return candidates.some((candidate) => /[ก-๙]/.test(candidate)) ? 'th-TH' : 'en-US';
}

function getLastAssistantText(messages: ChatMessage[]): string {
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  if (!lastAssistantMessage) return '';

  const textPart = lastAssistantMessage.parts.find((part) => part.type === 'text');
  return textPart?.type === 'text' ? textPart.text.trim() : '';
}

function normalizeSuggestionQuickReplies(suggestions: string[]) {
  return suggestions
    .filter((suggestion) => suggestion.trim().length > 0)
    .slice(0, 4)
    .map((suggestion) => ({
      actionType: 'message' as const,
      label: suggestion,
      text: suggestion,
    }));
}
