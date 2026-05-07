import type { ChatMessage } from '@/features/chat/types';
import type { TokenUsageSnapshot } from './schema';

import { buildImageResponseAudit, prepareTextMessagesForFinalization } from './finalization-helpers';

// ── Finalization contract types ───────────────────────────────────────────────

export type FinalizationStepName =
  | 'message_persistence'
  | 'working_memory'
  | 'memory_extraction'
  | 'audit';

export type FinalizationFailure = {
  step: FinalizationStepName;
  class: 'fatal' | 'best_effort_failed';
  error: unknown;
};

export type FinalizationResult = { ok: true } | { ok: false; failure: FinalizationFailure };

// ── Shared context ────────────────────────────────────────────────────────────

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

// ── Injectable dep types ──────────────────────────────────────────────────────

type PersistInput = {
  updatedMessages: ChatMessage[];
  threadId: string;
  userId: string | null;
  guestSessionId?: string | null;
  currentTitle: string;
  resolvedModel: string;
  creditCost: number;
  brandId: string | null;
  tokenUsageData: TokenUsageSnapshot | null | undefined;
};

type WorkingMemoryInput = {
  threadId: string;
  brandId: string | null;
  messages: Array<{ id?: string; role: string; parts?: Array<{ type?: string; text?: string }> }>;
};

type AuditSuccessInput = {
  routeKind: 'text' | 'image';
  resolvedModelId: string;
  creditCost: number;
  toolCallCount: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  outputJson?: Record<string, unknown>;
};

type AuditErrorInput = {
  errorMessage: string;
  routeKind: 'text' | 'image';
  resolvedModelId: string;
};

export type LogFn = (step: FinalizationStepName, error: unknown) => void;

export type TextFinalizationImpl = {
  persist?: (input: PersistInput) => Promise<void>;
  refreshWorkingMemory?: (input: WorkingMemoryInput) => Promise<unknown>;
  extractMemory?: (userId: string, messages: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>, threadId: string, memoryContext: string) => void;
  auditSuccess?: (runId: string, data: AuditSuccessInput) => Promise<void>;
  auditError?: (runId: string, data: AuditErrorInput) => Promise<void>;
  log?: LogFn;
};

export type ImageFinalizationImpl = {
  persist?: (input: PersistInput) => Promise<void>;
  auditSuccess?: (runId: string, data: AuditSuccessInput) => Promise<void>;
  auditError?: (runId: string, data: AuditErrorInput) => Promise<void>;
  log?: LogFn;
};

// ── Default logger ────────────────────────────────────────────────────────────

function defaultLog(step: FinalizationStepName, error: unknown) {
  console.error(`[finalization] best_effort_failed step=${step}`, { error });
}

// ── Lazy default implementations (loaded only in production, not at import time) ──

async function loadDefaults() {
  const [
    { persistChatResult },
    { refreshThreadWorkingMemoryFromMessages },
    { extractAndStoreMemory },
    { completeChatRunSuccess, completeChatRunError, buildChatRunOutputSummary, getFollowUpSuggestionCount, getToolCallCount },
  ] = await Promise.all([
    import('./persistence'),
    import('@/features/memory/server/working-memory'),
    import('@/lib/memory'),
    import('@/features/chat/audit/audit'),
  ]);

  return {
    persist: persistChatResult as (input: PersistInput) => Promise<void>,
    refreshWorkingMemory: refreshThreadWorkingMemoryFromMessages as unknown as (input: WorkingMemoryInput) => Promise<unknown>,
    extractMemory: extractAndStoreMemory as TextFinalizationImpl['extractMemory'],
    auditSuccess: (async (runId: string, data: AuditSuccessInput) => completeChatRunSuccess(runId, { ...data, outputJson: data.outputJson ?? {} })) as (runId: string, data: AuditSuccessInput) => Promise<void>,
    auditError: (async (runId: string, data: AuditErrorInput) => completeChatRunError(runId, data)) as (runId: string, data: AuditErrorInput) => Promise<void>,
    buildChatRunOutputSummary,
    getFollowUpSuggestionCount,
    getToolCallCount,
  };
}

// ── finalizeTextChatTurn ──────────────────────────────────────────────────────

export async function finalizeTextChatTurn(input: {
  updatedMessages: ChatMessage[];
  usage: TokenUsageSnapshot | null;
  finishCtx: ChatTurnFinishContext;
  _impl?: TextFinalizationImpl;
}): Promise<FinalizationResult> {
  const { updatedMessages, usage, finishCtx, _impl } = input;

  // _impl === undefined → production: load real DB-touching implementations lazily.
  // _impl provided (even partial) → test: use provided functions, fall back to no-ops.
  const defaults = _impl === undefined ? await loadDefaults() : null;
  const noop = async () => {};

  const persist = _impl?.persist ?? defaults!.persist;
  const refreshWorkingMemory = _impl?.refreshWorkingMemory ?? defaults?.refreshWorkingMemory ?? noop;
  const extractMemory = _impl?.extractMemory ?? defaults?.extractMemory ?? (() => undefined);
  const auditSuccess = _impl?.auditSuccess ?? defaults?.auditSuccess ?? noop;
  const auditError = _impl?.auditError ?? defaults?.auditError ?? noop;
  const log = _impl?.log ?? defaultLog;

  const buildOutputSummary = defaults?.buildChatRunOutputSummary;
  const getFollowUpCount = defaults?.getFollowUpSuggestionCount;
  const getToolCount = defaults?.getToolCallCount;

  // ── Fatal step: message preparation + persistence ─────────────────────────
  let prepared: Awaited<ReturnType<typeof prepareTextMessagesForFinalization>>;
  try {
    prepared = await prepareTextMessagesForFinalization({
      messages: updatedMessages,
      lastUserPrompt: finishCtx.lastUserPrompt,
      followUpSuggestionsEnabled: finishCtx.followUpSuggestionsEnabled,
    });

    await persist({
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
  } catch (error) {
    if (finishCtx.currentChatRunId) {
      await auditError(finishCtx.currentChatRunId, {
        errorMessage: error instanceof Error ? error.message : 'Unknown finalization error',
        routeKind: 'text',
        resolvedModelId: finishCtx.resolvedModel,
      }).catch((auditErr: unknown) => log('audit', auditErr));
    }
    return { ok: false, failure: { step: 'message_persistence', class: 'fatal', error } };
  }

  if (!finishCtx.userId) return { ok: true };

  // ── Best-effort steps: run in parallel ────────────────────────────────────
  const shouldExtractMemory = finishCtx.memoryEnabled && finishCtx.memoryExtractEnabled;

  const auditData: AuditSuccessInput = {
    routeKind: 'text',
    resolvedModelId: finishCtx.resolvedModel,
    creditCost: finishCtx.creditCost,
    toolCallCount: getToolCount ? getToolCount(prepared.messages) : 0,
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
    totalTokens: usage?.totalTokens,
    outputJson: buildOutputSummary ? buildOutputSummary({
      routeKind: 'text',
      messages: prepared.messages,
      followUpSuggestionCount: getFollowUpCount ? getFollowUpCount(prepared.messages) : 0,
      memoryExtracted: shouldExtractMemory,
      responseFormat: prepared.responseAudit,
    }) : undefined,
  };

  const bestEffortResults = await Promise.allSettled([
    // working_memory
    refreshWorkingMemory({
      threadId: finishCtx.threadId,
      brandId: finishCtx.brandId,
      messages: prepared.messages as WorkingMemoryInput['messages'],
    }),

    // memory_extraction
    shouldExtractMemory
      ? new Promise<void>((resolve) => {
          extractMemory(
            finishCtx.userId!,
            prepared.messages as Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>,
            finishCtx.threadId,
            finishCtx.memoryContext,
          );
          resolve();
        })
      : Promise.resolve(),

    // audit
    finishCtx.currentChatRunId
      ? auditSuccess(finishCtx.currentChatRunId, auditData)
      : Promise.resolve(),
  ]);

  const stepNames: FinalizationStepName[] = ['working_memory', 'memory_extraction', 'audit'];
  for (let i = 0; i < bestEffortResults.length; i++) {
    const result = bestEffortResults[i];
    if (result?.status === 'rejected') {
      log(stepNames[i]!, result.reason);
    }
  }

  return { ok: true };
}

// ── finalizeImageChatTurn ─────────────────────────────────────────────────────

export async function finalizeImageChatTurn(input: {
  updatedMessages: ChatMessage[];
  finishCtx: ChatTurnFinishContext;
  toolMessage: string;
  _impl?: ImageFinalizationImpl;
}): Promise<FinalizationResult> {
  const { updatedMessages, finishCtx, toolMessage, _impl } = input;

  const defaults = _impl === undefined ? await loadDefaults() : null;
  const noop = async () => {};

  const persist = _impl?.persist ?? defaults!.persist;
  const auditSuccess = _impl?.auditSuccess ?? defaults?.auditSuccess ?? noop;
  const auditError = _impl?.auditError ?? defaults?.auditError ?? noop;
  const log = _impl?.log ?? defaultLog;

  const buildOutputSummary = defaults?.buildChatRunOutputSummary;

  // ── Fatal step: persistence ───────────────────────────────────────────────
  try {
    await persist({
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
  } catch (error) {
    if (finishCtx.currentChatRunId) {
      await auditError(finishCtx.currentChatRunId, {
        errorMessage: error instanceof Error ? error.message : 'Unknown finalization error',
        routeKind: 'image',
        resolvedModelId: finishCtx.resolvedModel,
      }).catch((auditErr: unknown) => log('audit', auditErr));
    }
    return { ok: false, failure: { step: 'message_persistence', class: 'fatal', error } };
  }

  // ── Best-effort: audit ────────────────────────────────────────────────────
  if (finishCtx.currentChatRunId) {
    const [auditResult] = await Promise.allSettled([
      auditSuccess(finishCtx.currentChatRunId, {
        routeKind: 'image',
        resolvedModelId: finishCtx.resolvedModel,
        creditCost: finishCtx.creditCost,
        toolCallCount: 1,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        outputJson: buildOutputSummary ? buildOutputSummary({
          routeKind: 'image',
          responseFormat: buildImageResponseAudit(toolMessage, finishCtx.lastUserPrompt),
          generatedImage: { mediaType: 'image/kie-async' },
          memoryExtracted: false,
        }) : undefined,
      }),
    ]);
    if (auditResult?.status === 'rejected') {
      log('audit', auditResult.reason);
    }
  }

  return { ok: true };
}
