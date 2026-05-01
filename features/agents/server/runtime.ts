import { getSystemPrompt, resolveSystemPromptTemplate } from '@/lib/prompt';
import { assembleSystemPrompt } from '@/features/chat/server/prompt-assembly';
import { resolveEffectiveBrand } from './brand-resolution';
import type { Brand } from '@/features/brands/types';
import type { BrandAccessPolicy, BrandMode, FallbackBehavior } from '@/features/agents/types';
import type { SkillRuntimeContext } from '@/features/skills/server/activation';

export type AgentRuntimeAgent = {
  id: string;
  systemPrompt?: string | null;
  enabledTools?: string[] | null;
  documentIds?: string[] | null;
  brandId?: string | null;
  brandMode?: BrandMode | string | null;
  brandAccessPolicy?: BrandAccessPolicy | string | null;
  requiresBrandForRun?: boolean | null;
  fallbackBehavior?: FallbackBehavior | string | null;
};

export const EMPTY_SKILL_RUNTIME: SkillRuntimeContext = {
  catalogBlock: '',
  activatedSkills: [],
  activeSkillsBlock: '',
  skillResourcesBlock: '',
  skillToolIds: [],
};

export async function resolveAgentSkillRuntime(
  agent: Pick<AgentRuntimeAgent, 'id'> | null,
  userMessage: string | null | undefined,
): Promise<SkillRuntimeContext> {
  if (!agent?.id || !userMessage?.trim()) return EMPTY_SKILL_RUNTIME;

  const { getSkillsForAgent, resolveSkillRuntimeContext } = await import('@/features/skills/service');
  const skills = await getSkillsForAgent(agent.id);
  if (skills.length === 0) return EMPTY_SKILL_RUNTIME;

  return resolveSkillRuntimeContext(skills, userMessage);
}

export async function resolveAgentBrandRuntime(input: {
  userId: string | null | undefined;
  activeBrandId?: string | null;
  agent: AgentRuntimeAgent | null;
  enabled: boolean;
}) {
  if (!input.enabled || !input.userId) {
    return {
      brandResolution: null,
      activeBrand: null as Brand | null,
    };
  }

  const brandResolution = await resolveEffectiveBrand({
    userId: input.userId,
    activeBrandId: input.activeBrandId ?? null,
    agent: input.agent,
  });

  return {
    brandResolution,
    activeBrand: (brandResolution.effectiveBrand ?? null) as Brand | null,
  };
}

export function resolveAgentBaseSystemPrompt(input: {
  agent: AgentRuntimeAgent | null;
  fallbackPrompt?: string;
}): string {
  return resolveSystemPromptTemplate(input.agent?.systemPrompt ?? input.fallbackPrompt ?? getSystemPrompt());
}

export function mergeAgentToolIds(input: {
  baseToolIds: string[] | null;
  skillRuntime: Pick<SkillRuntimeContext, 'skillToolIds'>;
}): string[] | null {
  if (input.skillRuntime.skillToolIds.length === 0) return input.baseToolIds;
  if (input.baseToolIds === null) return null;
  return [...new Set([...input.baseToolIds, ...input.skillRuntime.skillToolIds])];
}

export function mergeAgentDocumentIds(input: {
  agentDocumentIds?: string[] | null;
  selectedDocumentIds?: string[] | null;
}): string[] | undefined {
  const agentDocIds = input.agentDocumentIds ?? [];
  const selectedDocIds = input.selectedDocumentIds ?? [];
  if (agentDocIds.length === 0 && selectedDocIds.length === 0) return undefined;
  return [...new Set([...agentDocIds, ...selectedDocIds])];
}

export function buildAgentRunSystemPrompt(input: {
  base: string;
  conversationSummaryBlock?: string;
  threadWorkingMemoryBlock?: string;
  isGrounded?: boolean;
  activeBrand: Brand | null;
  memoryContext?: string;
  sharedMemoryBlock?: string;
  domainContextBlock?: string;
  domainSetupBlock?: string;
  skillRuntime: Pick<SkillRuntimeContext, 'catalogBlock' | 'activeSkillsBlock' | 'skillResourcesBlock'>;
  examPrepBlock?: string;
  certBlock?: string;
  quizContextBlock?: string;
  brandPromptInstruction?: string | null;
  extraBlocks?: Array<string | null | undefined>;
}): string {
  const prompt = assembleSystemPrompt({
    base: input.base,
    conversationSummaryBlock: input.conversationSummaryBlock ?? '',
    threadWorkingMemoryBlock: input.threadWorkingMemoryBlock ?? '',
    isGrounded: input.isGrounded ?? false,
    activeBrand: input.activeBrand,
    memoryContext: input.memoryContext ?? '',
    sharedMemoryBlock: input.sharedMemoryBlock ?? '',
    domainContextBlock: input.domainContextBlock ?? '',
    domainSetupBlock: input.domainSetupBlock ?? '',
    skillRuntime: input.skillRuntime,
    examPrepBlock: input.examPrepBlock ?? '',
    certBlock: input.certBlock ?? '',
    quizContextBlock: input.quizContextBlock ?? '',
  });

  return prompt
    + (input.brandPromptInstruction
      ? `\n\n<brand_resolution>\n${input.brandPromptInstruction}\n</brand_resolution>`
      : '')
    + (input.extraBlocks ?? []).filter((block): block is string => Boolean(block)).join('');
}
