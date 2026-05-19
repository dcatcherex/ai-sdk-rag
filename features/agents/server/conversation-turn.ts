import { convertToModelMessages, stepCountIs, streamText } from 'ai';
import type { ChatMessage } from '@/features/chat/types';
import type { TokenUsageSnapshot } from '@/features/chat/server/schema';
import {
  finalizeImageChatTurn,
  finalizeTextChatTurn,
  type ChatTurnFinishContext,
  type FinalizationResult,
} from '@/features/chat/server/finalization';
import type { TaskFlowDecision } from '@/features/task-flows/types';
import { applyReadyTaskFlowPrompt } from '@/features/task-flows/server/runtime';
import {
  prepareAgentRun,
  prepareCanonicalAgentImageGeneration,
  runAgentText,
  startPreparedAgentImageGeneration,
  type PreparedAgentImageRun,
  type PreparedAgentRun,
} from './run-service';
import { buildAgentRunModelMessages } from './run-helpers';
import type { AgentRunRequest } from './run-types';
import {
  resolveConversationTurnExecution,
  type ConversationTurnExecutionMode,
} from './conversation-turn-decision';

export { resolveConversationTurnExecution, type ConversationTurnExecutionMode };

export type PreparedConversationTurn = {
  preparedRun: PreparedAgentRun;
  systemPrompt: string;
  executionMode: ConversationTurnExecutionMode;
  creditCost: number;
  imagePreflight: PreparedAgentImageRun | null;
};

type TurnUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
} | null | undefined;

type LineHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function prepareConversationTurn(input: {
  request: AgentRunRequest;
  taskFlow?: {
    decision: TaskFlowDecision;
    locale?: string;
  };
}): Promise<PreparedConversationTurn> {
  const preparedRun = await prepareAgentRun(input.request);
  const executionMode = resolveConversationTurnExecution({
    policy: input.request.policy,
    lastUserPrompt: preparedRun.lastUserPrompt,
  });
  const systemPrompt = applyReadyTaskFlowPrompt({
    baseSystemPrompt: preparedRun.systemPrompt,
    decision: input.taskFlow?.decision.status === 'ready' ? input.taskFlow.decision : null,
    locale: input.taskFlow?.locale ?? 'en-US',
  });
  const imagePreflight = executionMode === 'direct_image' && preparedRun.lastUserPrompt
    ? await prepareCanonicalAgentImageGeneration({
        prompt: preparedRun.lastUserPrompt,
        activeBrand: preparedRun.activeBrand,
        referenceImageUrls: (input.request.channelContext as { referenceImageUrls?: string[] } | undefined)
          ?.referenceImageUrls,
        source: input.request.identity.channel === 'web'
          ? 'chat'
          : input.request.identity.channel,
      })
    : null;

  return {
    preparedRun,
    systemPrompt,
    executionMode,
    creditCost: imagePreflight?.creditCost ?? preparedRun.creditCost,
    imagePreflight,
  };
}

export async function streamConversationTurnText(input: {
  turn: PreparedConversationTurn;
  messages?: Parameters<typeof convertToModelMessages>[0];
  experimentalContext?: Record<string, unknown>;
  onFinish?: (event: { text: string }) => void | Promise<void>;
}) {
  const { turn } = input;
  const prepared = turn.preparedRun;
  const messages = await convertToModelMessages(
    input.messages
      ?? buildAgentRunModelMessages(prepared.request.messages) as Parameters<typeof convertToModelMessages>[0],
  );

  return streamText({
    model: prepared.modelId,
    system: turn.systemPrompt,
    messages,
    stopWhen: stepCountIs(prepared.request.policy.maxSteps),
    ...(prepared.supportsTools && prepared.tools ? { tools: prepared.tools } : {}),
    ...(input.experimentalContext ? { experimental_context: input.experimentalContext } : {}),
    ...(input.onFinish ? { onFinish: input.onFinish } : {}),
  });
}

export async function runConversationTurnText(turn: PreparedConversationTurn) {
  return runAgentText({
    ...turn.preparedRun,
    systemPrompt: turn.systemPrompt,
  });
}

export async function startConversationTurnImage(input: {
  turn: PreparedConversationTurn;
  userId: string;
  threadId?: string;
}) {
  if (!input.turn.imagePreflight) {
    throw new Error('Image generation requires a prepared image turn.');
  }

  return startPreparedAgentImageGeneration({
    prepared: input.turn.imagePreflight,
    userId: input.userId,
    threadId: input.threadId,
  });
}

export function normalizeConversationTurnUsage(usage: TurnUsage): TokenUsageSnapshot | null {
  if (!usage) return null;

  const promptTokens = usage.inputTokens ?? 0;
  const completionTokens = usage.outputTokens ?? 0;

  return {
    promptTokens,
    completionTokens,
    totalTokens: usage.totalTokens ?? promptTokens + completionTokens,
  };
}

export function buildConversationTurnFinishContext(input: {
  turn: PreparedConversationTurn;
  threadId?: string;
  userId: string | null;
  guestSessionId?: string | null;
  currentTitle: string;
  brandId?: string | null;
  currentChatRunId?: string | null;
  followUpSuggestionsEnabled: boolean;
  memoryEnabled: boolean;
  memoryExtractEnabled: boolean;
  memoryContext: string;
  lastUserPrompt?: string | null;
}): ChatTurnFinishContext {
  const prepared = input.turn.preparedRun;

  return {
    threadId: input.threadId ?? prepared.request.threadId,
    userId: input.userId,
    guestSessionId: input.guestSessionId,
    currentTitle: input.currentTitle,
    resolvedModel: prepared.modelId,
    creditCost: input.turn.creditCost,
    brandId: input.brandId ?? prepared.activeBrand?.id ?? null,
    currentChatRunId: input.currentChatRunId,
    followUpSuggestionsEnabled: input.followUpSuggestionsEnabled,
    memoryEnabled: input.memoryEnabled,
    memoryExtractEnabled: input.memoryExtractEnabled,
    memoryContext: input.memoryContext,
    lastUserPrompt: input.lastUserPrompt ?? prepared.lastUserPrompt,
  };
}

export async function finalizeConversationTurnText(input: {
  turn: PreparedConversationTurn;
  updatedMessages: ChatMessage[];
  usage: TurnUsage;
  finish: Omit<Parameters<typeof buildConversationTurnFinishContext>[0], 'turn'>;
}): Promise<FinalizationResult> {
  return finalizeTextChatTurn({
    updatedMessages: input.updatedMessages,
    usage: normalizeConversationTurnUsage(input.usage),
    finishCtx: buildConversationTurnFinishContext({
      turn: input.turn,
      ...input.finish,
    }),
  });
}

export async function finalizeConversationTurnImage(input: {
  turn: PreparedConversationTurn;
  updatedMessages: ChatMessage[];
  toolMessage: string;
  finish: Omit<Parameters<typeof buildConversationTurnFinishContext>[0], 'turn'>;
}): Promise<FinalizationResult> {
  return finalizeImageChatTurn({
    updatedMessages: input.updatedMessages,
    toolMessage: input.toolMessage,
    finishCtx: buildConversationTurnFinishContext({
      turn: input.turn,
      ...input.finish,
    }),
  });
}

export async function finalizeLineTextConversationTurn(input: {
  historyMessages: LineHistoryMessage[];
  storedUserText: string;
  memoryUserText: string;
  assistantText: string;
  suggestionAssistantText?: string;
  threadId: string;
  memoryContext: string;
  shouldExtractMemory: boolean;
  linkedUserId?: string;
  lineUserId?: string;
  persist: () => Promise<void>;
  generateFollowUpSuggestions: (
    context: string,
    options: {
      domainHint?: string;
      skillHints?: string[];
      latestAssistantQuestion?: string;
    },
  ) => Promise<string[]>;
  followUpDomainHint?: string;
  followUpSkillHints?: string[];
  latestAssistantQuestion?: string;
}): Promise<{ suggestions: string[] }> {
  const contextStr = [
    ...input.historyMessages
      .slice(-4)
      .map((message) => `${message.role}: ${message.content.slice(0, 200)}`),
    `user: ${input.storedUserText.slice(0, 200)}`,
    `assistant: ${input.suggestionAssistantText ?? input.assistantText}`,
  ].join('\n');

  const [suggestions] = await Promise.all([
    input.generateFollowUpSuggestions(contextStr, {
      domainHint: input.followUpDomainHint,
      skillHints: input.followUpSkillHints,
      latestAssistantQuestion: input.latestAssistantQuestion,
    }),
    input.persist(),
  ]);

  if (input.shouldExtractMemory) {
    const {
      extractAndStoreLineUserMemory,
      extractAndStoreMemory,
    } = await import('@/lib/memory');
    const messagesForMemory = [
      ...input.historyMessages,
      { role: 'user' as const, content: input.memoryUserText },
      { role: 'assistant' as const, content: input.assistantText },
    ];

    if (input.linkedUserId) {
      void extractAndStoreMemory(
        input.linkedUserId,
        messagesForMemory,
        input.threadId,
        input.memoryContext,
      );
    } else if (input.lineUserId) {
      void extractAndStoreLineUserMemory(
        input.lineUserId,
        messagesForMemory,
        input.threadId,
        input.memoryContext,
      );
    }
  }

  return { suggestions };
}
