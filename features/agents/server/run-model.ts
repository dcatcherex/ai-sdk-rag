import { availableModels, chatModel } from '@/lib/ai';
import { getModelSlot } from '@/lib/ai-config';
import { toolDisabledModels } from '@/features/chat/server/routing';
import { selectModel, type ModelSelection } from '@/features/chat/server/model-selector';

import type { SkillRuntimeContext } from '@/features/skills/server/activation';
import type { AgentRunRequest } from './run-types';

export type { ModelSelection };

export type ResolvedRunModel = {
  enabledModelIds: string[];
  modelId: string;
  routingReason: string;
  creditCost: number;
  supportsTools: boolean;
  modelSelection: ModelSelection;
};

export function supportsToolsForRunModel(input: {
  allowTools: boolean;
  modelId: string;
}): boolean {
  return input.allowTools && !toolDisabledModels.has(input.modelId);
}

export function estimateRunContextTokens(input: {
  messages: AgentRunRequest['messages'];
  skillRuntime: Pick<SkillRuntimeContext, 'activeSkillsBlock' | 'skillResourcesBlock' | 'catalogBlock'>;
}): number {
  return input.messages.reduce((sum, message) => {
    const partsLength = message.parts ? JSON.stringify(message.parts).length : 0;
    return sum + Math.ceil((message.content.length + partsLength) / 4);
  }, 0)
    + Math.ceil(
      (input.skillRuntime.activeSkillsBlock.length
        + input.skillRuntime.skillResourcesBlock.length
        + input.skillRuntime.catalogBlock.length) / 4,
    )
    + 3000;
}

export function resolveRunModel(input: {
  request: Pick<AgentRunRequest, 'messages' | 'model' | 'enabledModelIds' | 'useWebSearch' | 'policy'>;
  resolvedAgent: { modelId?: string | null } | null;
  lastUserPrompt: string | null;
  skillRuntime: Pick<SkillRuntimeContext, 'activatedSkills' | 'activeSkillsBlock' | 'skillResourcesBlock' | 'catalogBlock'>;
  userScores?: Map<string, number>;
  getCreditCostForModel?: (modelId: string) => number;
  defaultChatModel?: string;
}): ResolvedRunModel {
  const {
    request,
    resolvedAgent,
    lastUserPrompt,
    skillRuntime,
    userScores,
    getCreditCostForModel = () => 0,
    defaultChatModel = chatModel,
  } = input;

  const enabledModelIds =
    request.enabledModelIds?.length
      ? request.enabledModelIds.filter((id) => availableModels.some((model) => model.id === id))
      : availableModels.map((model) => model.id);

  const estimatedInputTokens = estimateRunContextTokens({
    messages: request.messages,
    skillRuntime,
  });

  const modelSelection = selectModel({
    requestedModel: request.model ?? null,
    enabledModelIds,
    agentModelId: resolvedAgent?.modelId ?? null,
    prompt: lastUserPrompt,
    useWebSearch: request.useWebSearch,
    userScores,
    hasAgent: Boolean(resolvedAgent),
    hasActiveSkills: skillRuntime.activatedSkills.length > 0,
    messageCount: request.messages.length,
    estimatedInputTokens,
    allowTools: request.policy.allowTools,
    defaultChatModel,
  });

  const { modelId } = modelSelection;

  const REASON_LABEL: Record<string, string> = {
    manual_override: 'Manual selection',
    agent_override: 'Agent default model',
    image_intent: 'Image generation request',
    web_intent: 'Web search intent',
    code_intent: 'Coding intent',
    reasoning_intent: 'Reasoning intent',
    cost_optimized: 'Simple query → cost-optimized model',
    default: 'General chat',
  };

  return {
    enabledModelIds,
    modelId,
    routingReason: REASON_LABEL[modelSelection.reason] ?? modelSelection.reason,
    creditCost: getCreditCostForModel(modelId),
    supportsTools: modelSelection.supportsTools,
    modelSelection,
  };
}
