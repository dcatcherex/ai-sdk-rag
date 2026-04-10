import { availableModels, isStrongModel, chatModel, type Capability, type ModelOption } from '@/lib/ai';
import type { ModelScoreMap } from '@/lib/model-scores';

export type RoutingDecision = {
  modelId: string;
  reason: string;
};

/** Models that do not support tool calls */
export const toolDisabledModels = new Set(['google/gemini-2.5-flash-image']);

export const modelSupportsCapability = (modelId: string, capability: Capability): boolean => {
  const model = availableModels.find((m) => m.id === modelId);
  return (model?.capabilities ?? []).some((c) => c === capability);
};

export const isImageOnlyModel = (modelId: string): boolean =>
  modelSupportsCapability(modelId, 'image gen') && !modelSupportsCapability(modelId, 'text');

/**
 * Parse a model's context window string ("1m", "400K", "66k", "128k") into a token count.
 * Returns Infinity if not specified — treat as unlimited for filtering purposes.
 */
function parseContextTokens(context: string | undefined): number {
  if (!context) return Infinity;
  const lower = context.toLowerCase().trim();
  const num = parseFloat(lower);
  if (isNaN(num)) return Infinity;
  if (lower.endsWith('m')) return num * 1_000_000;
  if (lower.endsWith('k')) return num * 1_000;
  return num;
}

/**
 * Pick the best text-capable model from enabledModels.
 *
 * Ranking:
 *   1. User score (thumbs up/down per model) — highest first
 *   2. Cost as tiebreaker — ascending (cheaper wins)
 *
 * preferStrong: filter to isStrongModel() candidates before ranking.
 *   Falls back to full set if no strong model is enabled.
 * preferCheap: sort by cost ascending before applying score ranking.
 * estimatedContextTokens: exclude models whose context window is too small
 *   (uses 80% of declared window as the safe limit).
 */
function selectTextModel(options: {
  enabledModels: ModelOption[];
  userScores: ModelScoreMap | undefined;
  preferStrong?: boolean;
  preferCheap?: boolean;
  estimatedContextTokens?: number;
  safeFallback: string;
}): string {
  const { enabledModels, userScores, preferStrong, preferCheap, estimatedContextTokens, safeFallback } = options;
  let textModels = enabledModels.filter((m) => (m.capabilities ?? []).includes('text'));
  if (textModels.length === 0) return safeFallback;

  // Phase 4: filter out models whose context window can't hold the current conversation.
  // Keep all candidates if none pass — degrade gracefully rather than hard-fail.
  if (estimatedContextTokens && estimatedContextTokens > 0) {
    const fitting = textModels.filter((m) => estimatedContextTokens < parseContextTokens(m.context) * 0.8);
    if (fitting.length > 0) textModels = fitting;
  }

  const getUserScore = (modelId: string): number => {
    if (!userScores || userScores.size === 0) return 0;
    let total = 0;
    for (const [key, val] of userScores) {
      if (key.startsWith(`${modelId}::`)) total += val;
    }
    return total;
  };

  let candidates = textModels;
  if (preferStrong) {
    const strong = textModels.filter((m) => isStrongModel(m.id));
    if (strong.length > 0) candidates = strong;
  } else if (preferCheap) {
    // Mirror of preferStrong: filter to non-strong (cheap) models first.
    // Falls back to full set if no cheap model is enabled.
    const cheap = textModels.filter((m) => !isStrongModel(m.id));
    if (cheap.length > 0) candidates = cheap;
  }

  return (
    [...candidates].sort((a, b) => {
      const scoreDiff = getUserScore(b.id) - getUserScore(a.id);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.inputCost ?? 0) - (b.inputCost ?? 0); // cheaper wins ties
    })[0]?.id ?? safeFallback
  );
}

export const getModelByIntent = (options: {
  prompt: string | null;
  enabledModelIds: string[];
  useWebSearch?: boolean;
  userScores?: ModelScoreMap;
  // Phase 3: cost optimization context
  hasAgent?: boolean;
  hasActiveSkills?: boolean;
  messageCount?: number;
  // Phase 4: context-length awareness
  estimatedContextTokens?: number;
}): RoutingDecision => {
  const { prompt, enabledModelIds, useWebSearch, userScores, hasAgent, hasActiveSkills, messageCount, estimatedContextTokens } = options;
  const enabledModels = availableModels.filter((m) => enabledModelIds.includes(m.id)) as ModelOption[];
  const safeFallback = enabledModels[0]?.id ?? chatModel;

  if (!prompt) return { modelId: safeFallback, reason: 'Empty prompt' };

  const lower = prompt.toLowerCase();
  const wordCount = prompt.trim().split(/\s+/).length;

  const wantsImage =
    lower.startsWith('create image') ||
    lower.startsWith('generate image') ||
    lower.includes('image of') ||
    lower.includes('draw ') ||
    lower.includes('illustration');

  // 'source' removed — too broad ("source of this claim")
  const wantsWeb =
    Boolean(useWebSearch) ||
    lower.includes('search') ||
    lower.includes('latest') ||
    lower.includes('news') ||
    lower.includes('web');

  // 'api' and 'function' removed — too many false positives outside coding contexts
  const wantsCode =
    lower.includes('code') ||
    lower.includes('coding') ||
    lower.includes('typescript') ||
    lower.includes('javascript') ||
    lower.includes('python') ||
    lower.includes('refactor') ||
    lower.includes('debug') ||
    lower.includes('implement') ||
    lower.includes('class');

  const wantsReasoning =
    lower.includes('analy') ||
    lower.includes('reason') ||
    lower.includes('compare') ||
    lower.includes('evaluate') ||
    lower.includes('diagnose') ||
    lower.includes('pros and cons') ||
    lower.includes('tradeoff');

  const pickByCapability = (capability: Capability): string | undefined => {
    const capable = enabledModels.filter((m) =>
      (m.capabilities ?? []).some((c) => c === capability)
    );
    if (capable.length === 0) return undefined;
    if (!userScores || userScores.size === 0) return capable[0]?.id;
    let best = capable[0]!;
    let bestScore = -Infinity;
    for (const m of capable) {
      let total = 0;
      for (const [key, val] of userScores) {
        if (key.startsWith(`${m.id}::`)) total += val;
      }
      if (total > bestScore) { bestScore = total; best = m; }
    }
    return best.id;
  };

  if (wantsImage) {
    const modelId = pickByCapability('image gen');
    return modelId
      ? { modelId, reason: 'Image generation request' }
      : { modelId: safeFallback, reason: 'Image request but no image-capable model enabled' };
  }

  if (wantsWeb) {
    const modelId = pickByCapability('web search');
    return modelId
      ? { modelId, reason: 'Web search intent' }
      : { modelId: safeFallback, reason: 'Web search intent but no web-capable model enabled' };
  }

  if (wantsCode) {
    const modelId = selectTextModel({ enabledModels, userScores, preferStrong: true, estimatedContextTokens, safeFallback });
    return { modelId, reason: 'Coding intent' };
  }

  if (wantsReasoning) {
    const modelId = selectTextModel({ enabledModels, userScores, preferStrong: true, estimatedContextTokens, safeFallback });
    return { modelId, reason: 'Reasoning intent' };
  }

  // Phase 3: cheap-route simple, non-specialized queries.
  // Eligibility: short prompt, fresh conversation, no agent/skills overhead.
  const isSimpleQuery =
    wordCount < 20 &&
    !hasAgent &&
    !hasActiveSkills &&
    (messageCount ?? 0) <= 2;

  if (isSimpleQuery) {
    const modelId = selectTextModel({ enabledModels, userScores, preferCheap: true, estimatedContextTokens, safeFallback });
    return { modelId, reason: 'Simple query → cost-optimized model' };
  }

  // General chat: user score first, cost as tiebreaker
  const modelId = selectTextModel({ enabledModels, userScores, estimatedContextTokens, safeFallback });
  return { modelId, reason: 'General chat' };
};
