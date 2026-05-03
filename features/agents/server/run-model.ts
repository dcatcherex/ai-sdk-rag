import { availableModels, chatModel } from '@/lib/ai';
import { getModelByIntent, toolDisabledModels } from '@/features/chat/server/routing';
import type { SkillRuntimeContext } from '@/features/skills/server/activation';
import type { AgentRunRequest } from './run-types';

export type ResolvedRunModel = {
  enabledModelIds: string[];
  modelId: string;
  routingReason: string;
  creditCost: number;
  supportsTools: boolean;
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
}): ResolvedRunModel {
  const {
    request,
    resolvedAgent,
    lastUserPrompt,
    skillRuntime,
    userScores,
    getCreditCostForModel = () => 0,
  } = input;

  const enabledModelIds =
    request.enabledModelIds?.length
      ? request.enabledModelIds.filter((id) => availableModels.some((model) => model.id === id))
      : availableModels.map((model) => model.id);

  const manualModel = request.model && request.model !== 'auto' ? request.model : null;
  const manualResolved = manualModel && enabledModelIds.includes(manualModel) ? manualModel : null;
  const agentAutoModel =
    (!request.model || request.model === 'auto')
    && resolvedAgent?.modelId
    && enabledModelIds.includes(resolvedAgent.modelId)
      ? resolvedAgent.modelId
      : null;

  const estimatedContextTokens = estimateRunContextTokens({
    messages: request.messages,
    skillRuntime,
  });

  const routedModel = manualResolved
    ? { modelId: manualResolved, reason: 'Manual selection' }
    : agentAutoModel
      ? { modelId: agentAutoModel, reason: 'Agent default model' }
      : getModelByIntent({
          prompt: lastUserPrompt,
          enabledModelIds: enabledModelIds.length > 0 ? enabledModelIds : [chatModel],
          useWebSearch: request.useWebSearch,
          userScores,
          hasAgent: Boolean(resolvedAgent),
          hasActiveSkills: skillRuntime.activatedSkills.length > 0,
          messageCount: request.messages.length,
          estimatedContextTokens,
        });

  const modelId = routedModel.modelId;

  return {
    enabledModelIds,
    modelId,
    routingReason: routedModel.reason,
    creditCost: getCreditCostForModel(modelId),
    supportsTools: supportsToolsForRunModel({
      allowTools: request.policy.allowTools,
      modelId,
    }),
  };
}
