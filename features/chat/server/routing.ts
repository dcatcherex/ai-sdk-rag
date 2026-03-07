import { availableModels, chatModel, type Capability } from '@/lib/ai';
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

export const getModelByIntent = (options: {
  prompt: string | null;
  enabledModelIds: string[];
  useWebSearch?: boolean;
  userScores?: ModelScoreMap;
}): RoutingDecision => {
  const { prompt, enabledModelIds, useWebSearch, userScores } = options;
  const enabledModels = availableModels.filter((m) => enabledModelIds.includes(m.id));
  const safeFallback = enabledModels[0]?.id ?? chatModel;
  const fallback: RoutingDecision = { modelId: safeFallback, reason: 'Fallback to first enabled model' };

  if (!prompt) return { modelId: safeFallback, reason: 'Empty prompt' };

  const lower = prompt.toLowerCase();
  const wantsImage =
    lower.startsWith('create image') ||
    lower.startsWith('generate image') ||
    lower.includes('image of') ||
    lower.includes('draw ') ||
    lower.includes('illustration');
  const wantsWeb =
    Boolean(useWebSearch) ||
    lower.includes('search') ||
    lower.includes('latest') ||
    lower.includes('news') ||
    lower.includes('web') ||
    lower.includes('source');
  const wantsCode =
    lower.includes('code') ||
    lower.includes('coding') ||
    lower.includes('typescript') ||
    lower.includes('javascript') ||
    lower.includes('python') ||
    lower.includes('refactor') ||
    lower.includes('debug') ||
    lower.includes('implement') ||
    lower.includes('api') ||
    lower.includes('function') ||
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
    return enabledModelIds.includes('openai/gpt-5.2')
      ? { modelId: 'openai/gpt-5.2', reason: 'Coding intent' }
      : { modelId: safeFallback, reason: 'Coding intent but GPT-5.2 not enabled' };
  }

  if (wantsReasoning) {
    return enabledModelIds.includes('anthropic/claude-opus-4.6')
      ? { modelId: 'anthropic/claude-opus-4.6', reason: 'Reasoning intent' }
      : { modelId: safeFallback, reason: 'Reasoning intent but Opus not enabled' };
  }

  // Score-biased general chat
  if (userScores && userScores.size > 0) {
    const textModels = enabledModels.filter((m) =>
      (m.capabilities ?? []).some((c) => c === 'text')
    );
    if (textModels.length > 0) {
      let best = textModels[0]!;
      let bestScore = -Infinity;
      for (const m of textModels) {
        let total = 0;
        for (const [key, val] of userScores) {
          if (key.startsWith(`${m.id}::`)) total += val;
        }
        if (total > bestScore) { bestScore = total; best = m; }
      }
      return { modelId: best.id, reason: 'General chat (score-biased)' };
    }
  }

  return enabledModelIds.includes('google/gemini-3-flash')
    ? { modelId: 'google/gemini-3-flash', reason: 'General chat' }
    : fallback;
};
