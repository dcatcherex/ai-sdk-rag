import type { ResponseAuditSummary } from '@/features/response-format/server/audit';
import type { ChatMessage, ChatMessageMetadata } from '@/features/chat/types';

export function buildChatRunOutputSummary(input: {
  routeKind: 'text' | 'image';
  messages?: ChatMessage[];
  followUpSuggestionCount?: number;
  generatedImage?: { mediaType: string };
  memoryExtracted?: boolean;
  responseFormat?: ResponseAuditSummary | null;
}) {
  const toolNames = input.messages ? getUsedToolNames(input.messages) : [];

  return {
    routeKind: input.routeKind,
    usedTools: toolNames.length > 0,
    toolNames,
    followUpSuggestionCount: input.followUpSuggestionCount ?? 0,
    memoryExtracted: input.memoryExtracted ?? false,
    responseIntent: input.responseFormat?.responseIntent ?? null,
    responseFormats: input.responseFormat?.responseFormats ?? [],
    templateKey: input.responseFormat?.templateKey ?? null,
    quickReplyCount: input.responseFormat?.quickReplyCount ?? 0,
    escalationCreated: input.responseFormat?.escalationCreated ?? false,
    workflowType: input.responseFormat?.workflowType ?? null,
    renderFallbackUsed: input.responseFormat?.renderFallbackUsed ?? false,
    parseConfidence: input.responseFormat?.parseConfidence ?? null,
    generatedImage: input.generatedImage
      ? { mediaType: input.generatedImage.mediaType }
      : null,
  };
}

export function getUsedToolNames(messages: ChatMessage[]): string[] {
  const names = new Set<string>();

  for (const message of messages) {
    for (const part of message.parts) {
      if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
        names.add(part.type.slice(5));
      }
    }
  }

  return [...names];
}

export function getToolCallCount(messages: ChatMessage[]): number {
  let count = 0;

  for (const message of messages) {
    for (const part of message.parts) {
      if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
        count += 1;
      }
    }
  }

  return count;
}

export function getFollowUpSuggestionCount(messages: ChatMessage[]): number {
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  const metadata = (lastAssistantMessage?.metadata ?? null) as ChatMessageMetadata | null;
  return metadata?.followUpSuggestions?.length ?? 0;
}
