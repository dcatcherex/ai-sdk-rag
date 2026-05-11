import { buildResponseAuditSummary } from '@/features/response-format/server/audit';
import { buildResponsePlan } from '@/features/response-format/server/select';
import { buildResponsePlanFromTaskFlow } from '@/features/response-format/service';
import type { ChatMessage, ChatMessageMetadata } from '@/features/chat/types';
import type { ResponseAuditSummary } from '@/features/response-format/server/audit';
import type { RichMessageInstance } from '@/features/rich-messages/types';
import type { TaskFlowDecision } from '@/features/task-flows/types';

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

export type AssistantResponseArtifacts = {
  responseAudit: ResponseAuditSummary | null;
  richMessagePart?: {
    type: 'data-rich-message';
    data: RichMessageInstance;
  };
};

export async function prepareTextMessagesForFinalization({
  messages,
  lastUserPrompt,
  followUpSuggestionsEnabled,
  generateSuggestions,
}: PrepareTextMessagesOptions): Promise<PrepareTextMessagesResult> {
  const lastAssistantIdx = messages.map((message) => message.role).lastIndexOf('assistant');
  let messagesWithSuggestions = messages;

  if (lastAssistantIdx !== -1 && followUpSuggestionsEnabled) {
    if (!generateSuggestions) {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-suggestions');
      generateSuggestions = generateFollowUpSuggestions;
    }
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
      messagesWithSuggestions = messages.map<ChatMessage>((message, index) =>
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
  const lastAssistantMetadata = lastAssistantIdx !== -1
    ? messagesWithSuggestions[lastAssistantIdx]?.metadata as ChatMessageMetadata | undefined
    : undefined;
  const taskFlowDecision = lastAssistantMetadata?.taskFlow
    ? buildTaskFlowDecisionFromMetadata(lastAssistantMetadata)
    : null;
  const artifacts = lastAssistantText
    ? await buildAssistantResponseArtifacts({
        assistantText: lastAssistantText,
        lastUserPrompt,
        followUpSuggestions:
          (lastAssistantMetadata?.followUpSuggestions) ?? [],
        taskFlowDecision,
        source: 'finalization',
      })
    : { responseAudit: null };

  if (artifacts.richMessagePart && lastAssistantIdx !== -1) {
    messagesWithSuggestions = messagesWithSuggestions.map<ChatMessage>((message, index) =>
      index === lastAssistantIdx
        ? {
            ...message,
            parts: [
              ...message.parts.filter((part) => part.type !== 'data-rich-message'),
              artifacts.richMessagePart as ChatMessage['parts'][number],
            ],
          }
        : message,
    );
  }

  const responseAudit = artifacts.responseAudit;
  if (responseAudit != null && lastAssistantIdx !== -1) {
    messagesWithSuggestions = messagesWithSuggestions.map<ChatMessage>((message, index) =>
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

export async function buildAssistantResponseArtifacts(input: {
  assistantText: string;
  lastUserPrompt: string | null | undefined;
  followUpSuggestions?: string[];
  taskFlowDecision?: Extract<TaskFlowDecision, { status: 'ready' }> | null;
  source: 'finalization' | 'live_stream';
}): Promise<AssistantResponseArtifacts> {
  const locale = inferFinalizationLocale(input.assistantText, input.lastUserPrompt ?? '');
  const responsePlan = input.taskFlowDecision
    ? buildResponsePlanFromTaskFlow({
        assistantText: input.assistantText,
        userText: input.lastUserPrompt ?? '',
        locale,
        quickReplies: normalizeSuggestionQuickReplies(input.followUpSuggestions ?? []),
        taskFlowDecision: input.taskFlowDecision,
      })
    : buildResponsePlan({
        text: input.assistantText,
        userText: input.lastUserPrompt ?? '',
        locale,
        quickReplies: normalizeSuggestionQuickReplies(input.followUpSuggestions ?? []),
      });
  const responseAudit = buildResponseAuditSummary(responsePlan);

  if (!responsePlan.card) {
    return { responseAudit };
  }

  const { renderRichMessageServer } = await import('@/features/rich-messages/server/runtime');
  const renderedRichMessage = await renderRichMessageServer({
    templateKey: responsePlan.card.templateKey,
    data: responsePlan.card.data,
    channel: 'web',
    locale: responsePlan.locale,
    metadata: {
      source: input.source,
    },
  });

  if (!renderedRichMessage.ok) {
    return { responseAudit };
  }

  return {
    responseAudit,
    richMessagePart: {
      type: 'data-rich-message',
      data: renderedRichMessage.instance,
    },
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

function buildTaskFlowDecisionFromMetadata(
  metadata: ChatMessageMetadata,
): Extract<TaskFlowDecision, { status: 'ready' }> | null {
  if (metadata.taskFlow?.status !== 'ready') {
    return null;
  }

  return {
    status: 'ready',
    flowKey: metadata.taskFlow.flowKey,
    confidence: 1,
    source: 'state',
    slots: metadata.taskFlow.slots,
  };
}
