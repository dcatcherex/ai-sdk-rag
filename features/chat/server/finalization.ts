import { extractAndStoreMemory } from '@/lib/memory';
import {
  buildChatRunOutputSummary,
  completeChatRunError,
  completeChatRunSuccess,
  getFollowUpSuggestionCount,
  getToolCallCount,
} from '@/features/chat/audit/audit';
import { refreshThreadWorkingMemoryFromMessages } from '@/features/memory/server/working-memory';
import type { ChatMessage } from '@/features/chat/types';
import type { TokenUsageSnapshot } from './schema';
import { buildImageResponseAudit, prepareTextMessagesForFinalization } from './finalization-helpers';
import { persistChatResult } from './persistence';

export type ChatTurnFinishContext = {
  threadId: string;
  userId: string | null;
  guestSessionId?: string | null;
  currentTitle: string;
  resolvedModel: string;
  creditCost: number;
  brandId: string | null;
  currentChatRunId?: string | null;
  followUpSuggestionsEnabled: boolean;
  memoryEnabled: boolean;
  memoryExtractEnabled: boolean;
  memoryContext: string;
  lastUserPrompt: string | null | undefined;
};

export async function finalizeTextChatTurn(input: {
  updatedMessages: ChatMessage[];
  usage: TokenUsageSnapshot | null;
  finishCtx: ChatTurnFinishContext;
}): Promise<void> {
  const { updatedMessages, usage, finishCtx } = input;

  try {
    const prepared = await prepareTextMessagesForFinalization({
      messages: updatedMessages,
      lastUserPrompt: finishCtx.lastUserPrompt,
      followUpSuggestionsEnabled: finishCtx.followUpSuggestionsEnabled,
    });

    await persistChatResult({
      updatedMessages: prepared.messages,
      threadId: finishCtx.threadId,
      userId: finishCtx.userId,
      guestSessionId: finishCtx.guestSessionId,
      currentTitle: finishCtx.currentTitle,
      resolvedModel: finishCtx.resolvedModel,
      creditCost: finishCtx.creditCost,
      brandId: finishCtx.brandId,
      tokenUsageData: usage,
    });

    if (finishCtx.userId) {
      await refreshThreadWorkingMemoryFromMessages({
        threadId: finishCtx.threadId,
        brandId: finishCtx.brandId,
        messages: prepared.messages as Array<{
          id?: string;
          role: string;
          parts?: Array<{ type?: string; text?: string }>;
        }>,
      }).catch((error: unknown) => console.error('Failed to refresh thread working memory:', error));

      const shouldExtractMemory = finishCtx.memoryEnabled && finishCtx.memoryExtractEnabled;
      if (shouldExtractMemory) {
        void extractAndStoreMemory(
          finishCtx.userId,
          prepared.messages as Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>,
          finishCtx.threadId,
          finishCtx.memoryContext,
        );
      }

      if (finishCtx.currentChatRunId) {
        await completeChatRunSuccess(finishCtx.currentChatRunId, {
          routeKind: 'text',
          resolvedModelId: finishCtx.resolvedModel,
          creditCost: finishCtx.creditCost,
          toolCallCount: getToolCallCount(prepared.messages),
          promptTokens: usage?.promptTokens,
          completionTokens: usage?.completionTokens,
          totalTokens: usage?.totalTokens,
          outputJson: buildChatRunOutputSummary({
            routeKind: 'text',
            messages: prepared.messages,
            followUpSuggestionCount: getFollowUpSuggestionCount(prepared.messages),
            memoryExtracted: shouldExtractMemory,
            responseFormat: prepared.responseAudit,
          }),
        });
      }
    }
  } catch (error) {
    console.error('Failed to finalize chat run:', error);
    if (finishCtx.currentChatRunId) {
      await completeChatRunError(finishCtx.currentChatRunId, {
        errorMessage: error instanceof Error ? error.message : 'Unknown finalization error',
        routeKind: 'text',
        resolvedModelId: finishCtx.resolvedModel,
      }).catch((auditError: unknown) => console.error('Failed to mark chat run as error:', auditError));
    }
  }
}

export async function finalizeImageChatTurn(input: {
  updatedMessages: ChatMessage[];
  finishCtx: ChatTurnFinishContext;
  toolMessage: string;
}): Promise<void> {
  const { updatedMessages, finishCtx, toolMessage } = input;

  try {
    await persistChatResult({
      updatedMessages,
      threadId: finishCtx.threadId,
      userId: finishCtx.userId,
      guestSessionId: finishCtx.guestSessionId,
      currentTitle: finishCtx.currentTitle,
      resolvedModel: finishCtx.resolvedModel,
      creditCost: finishCtx.creditCost,
      brandId: finishCtx.brandId,
      tokenUsageData: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    });

    if (finishCtx.currentChatRunId) {
      await completeChatRunSuccess(finishCtx.currentChatRunId, {
        routeKind: 'image',
        resolvedModelId: finishCtx.resolvedModel,
        creditCost: finishCtx.creditCost,
        toolCallCount: 1,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        outputJson: buildChatRunOutputSummary({
          routeKind: 'image',
          responseFormat: buildImageResponseAudit(toolMessage, finishCtx.lastUserPrompt),
          generatedImage: { mediaType: 'image/kie-async' },
          memoryExtracted: false,
        }),
      });
    }
  } catch (error) {
    console.error('Failed to finalize async image chat run:', error);
    if (finishCtx.currentChatRunId) {
      await completeChatRunError(finishCtx.currentChatRunId, {
        errorMessage: error instanceof Error ? error.message : 'Unknown finalization error',
        routeKind: 'image',
        resolvedModelId: finishCtx.resolvedModel,
      }).catch((auditError: unknown) => console.error('Failed to mark image chat run as error:', auditError));
    }
  }
}
