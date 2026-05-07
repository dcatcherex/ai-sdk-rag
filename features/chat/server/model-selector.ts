import { availableModels, chatModel } from '@/lib/ai';
import { getModelByIntent, toolDisabledModels } from './routing';
import type { ModelScoreMap } from '@/lib/model-scores';

export type ModelSelectionReason =
  | 'image_intent'
  | 'web_intent'
  | 'code_intent'
  | 'reasoning_intent'
  | 'manual_override'
  | 'agent_override'
  | 'cost_optimized'
  | 'default';

export type ModelSelection = {
  modelId: string;
  reason: ModelSelectionReason;
  supportsTools: boolean;
  estimatedInputTokens: number;
};

/** Maps routing.ts string reasons to typed ModelSelectionReason. */
function toTypedReason(raw: string): ModelSelectionReason {
  switch (raw) {
    case 'Image generation request': return 'image_intent';
    case 'Web search intent': return 'web_intent';
    case 'Coding intent': return 'code_intent';
    case 'Reasoning intent': return 'reasoning_intent';
    case 'Simple query → cost-optimized model': return 'cost_optimized';
    default: return 'default';
  }
}

/**
 * Single entry point for model selection across chat, agent runs, and team runs.
 *
 * Priority: manual_override → agent_override → intent routing.
 * Returns a fully-typed ModelSelection including tools support and token estimate.
 */
export function selectModel(input: {
  requestedModel: string | null;
  enabledModelIds: string[];
  agentModelId: string | null;
  prompt: string | null;
  useWebSearch?: boolean;
  userScores?: ModelScoreMap;
  hasAgent?: boolean;
  hasActiveSkills?: boolean;
  messageCount?: number;
  estimatedInputTokens: number;
  allowTools: boolean;
  defaultChatModel?: string;
}): ModelSelection {
  const {
    requestedModel,
    enabledModelIds,
    agentModelId,
    prompt,
    useWebSearch,
    userScores,
    hasAgent,
    hasActiveSkills,
    messageCount,
    estimatedInputTokens,
    allowTools,
    defaultChatModel = chatModel,
  } = input;

  const validIds =
    enabledModelIds.length > 0
      ? enabledModelIds.filter((id) => availableModels.some((m) => m.id === id))
      : availableModels.map((m) => m.id);

  const manualResolved =
    requestedModel && requestedModel !== 'auto' && validIds.includes(requestedModel)
      ? requestedModel
      : null;

  const agentResolved =
    !manualResolved &&
    (!requestedModel || requestedModel === 'auto') &&
    agentModelId &&
    validIds.includes(agentModelId)
      ? agentModelId
      : null;

  let modelId: string;
  let reason: ModelSelectionReason;

  if (manualResolved) {
    modelId = manualResolved;
    reason = 'manual_override';
  } else if (agentResolved) {
    modelId = agentResolved;
    reason = 'agent_override';
  } else {
    const routed = getModelByIntent({
      prompt,
      enabledModelIds: validIds.length > 0 ? validIds : [defaultChatModel],
      useWebSearch,
      userScores,
      hasAgent,
      hasActiveSkills,
      messageCount,
      estimatedContextTokens: estimatedInputTokens,
    });
    modelId = routed.modelId;
    reason = toTypedReason(routed.reason);
  }

  const supportsTools = allowTools && !toolDisabledModels.has(modelId);

  return { modelId, reason, supportsTools, estimatedInputTokens };
}
