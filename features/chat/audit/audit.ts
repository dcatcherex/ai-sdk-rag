import "server-only";

import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { chatRun } from "@/db/schema";
import { db } from "@/lib/db";
import type { ChatMessage, RoutingMetadata } from "@/features/chat/types";
import {
  buildChatRunOutputSummary,
  getFollowUpSuggestionCount,
  getToolCallCount,
  getUsedToolNames,
} from './summary';

type StartChatRunInput = {
  userId: string;
  threadId: string;
  agentId?: string | null;
  brandId?: string | null;
  requestedModelId?: string | null;
  useWebSearch?: boolean;
  inputJson: Record<string, unknown>;
};

type ChatRunSuccessInput = {
  routeKind: "text" | "image";
  resolvedModelId: string;
  creditCost: number;
  outputJson: Record<string, unknown>;
  toolCallCount: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
};

export async function startChatRun(input: StartChatRunInput): Promise<string> {
  const id = nanoid();
  await db.insert(chatRun).values({
    id,
    userId: input.userId,
    threadId: input.threadId,
    agentId: input.agentId ?? null,
    brandId: input.brandId ?? null,
    requestedModelId: input.requestedModelId ?? null,
    useWebSearch: input.useWebSearch ?? false,
    inputJson: input.inputJson,
    status: "pending",
    routeKind: "text",
    startedAt: new Date(),
  });
  return id;
}

export async function updateChatRunRouting(
  runId: string,
  payload: {
    routeKind?: "text" | "image";
    resolvedModelId?: string | null;
    routing?: RoutingMetadata;
  },
) {
  await db
    .update(chatRun)
    .set({
      routeKind: payload.routeKind,
      resolvedModelId: payload.resolvedModelId ?? null,
      routingMode: payload.routing?.mode ?? null,
      routingReason: payload.routing?.reason ?? null,
    })
    .where(eq(chatRun.id, runId));
}

export async function completeChatRunSuccess(runId: string, payload: ChatRunSuccessInput) {
  await db
    .update(chatRun)
    .set({
      status: "success",
      routeKind: payload.routeKind,
      resolvedModelId: payload.resolvedModelId,
      usedTools: payload.toolCallCount > 0,
      toolCallCount: payload.toolCallCount,
      outputJson: payload.outputJson,
      creditCost: payload.creditCost,
      promptTokens: payload.promptTokens ?? null,
      completionTokens: payload.completionTokens ?? null,
      totalTokens: payload.totalTokens ?? null,
      errorMessage: null,
      completedAt: new Date(),
    })
    .where(eq(chatRun.id, runId));
}

export async function completeChatRunError(
  runId: string,
  payload: {
    errorMessage: string;
    routeKind?: "text" | "image";
    resolvedModelId?: string | null;
  },
) {
  await db
    .update(chatRun)
    .set({
      status: "error",
      routeKind: payload.routeKind,
      resolvedModelId: payload.resolvedModelId ?? null,
      errorMessage: payload.errorMessage,
      completedAt: new Date(),
    })
    .where(eq(chatRun.id, runId));
}

export function buildChatRunInputSummary(input: {
  messages: ChatMessage[];
  requestedModelId?: string | null;
  useWebSearch?: boolean;
  selectedDocumentIds?: string[] | undefined;
  enabledModelIds?: string[] | undefined;
  agentId?: string | null;
  brandId?: string | null;
  quizContext?: { messageId: string } | undefined;
  activeToolIds?: string[] | null;
  activeSkillIds?: string[];
  lastUserPrompt?: string | null;
}) {
  return {
    messageCount: input.messages.length,
    lastUserPromptLength: input.lastUserPrompt?.length ?? 0,
    requestedModelId: input.requestedModelId ?? null,
    useWebSearch: input.useWebSearch ?? false,
    selectedDocumentCount: input.selectedDocumentIds?.length ?? 0,
    enabledModelCount: input.enabledModelIds?.length ?? 0,
    hasAgent: !!input.agentId,
    hasBrand: !!input.brandId,
    hasQuizContext: !!input.quizContext,
    activeToolIds: input.activeToolIds ?? null,
    activeSkillIds: input.activeSkillIds ?? [],
  };
}

export { buildChatRunOutputSummary, getFollowUpSuggestionCount, getToolCallCount, getUsedToolNames };
