import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agent } from '@/db/schema';
import { getUserMemoryContext } from '@/lib/memory';
import { renderDomainContextPromptBlock } from '@/features/domain-profiles/server/prompt';
import { buildDomainSetupPromptBlock } from '@/features/domain-profiles/server/setup';
import type { DomainProfileOwnerContext, ResolvedDomainContext } from '@/features/domain-profiles/types';
import type { Agent } from '@/features/agents/types';
import type { SkillRuntimeContext } from '@/features/skills/server/activation';
import type { AgentRunRequest } from './run-types';
import { EMPTY_SKILL_RUNTIME, resolveAgentBrandRuntime, resolveAgentSkillRuntime } from './runtime';
import { getLastUserPromptFromRunMessages } from './run-helpers';

export type PreparedAgentRunChannelContextOverrides = {
  memoryContext?: string;
  lineChannelId?: string;
  domainContextBlock?: string;
  domainSetupBlock?: string;
  agentOverride?: Agent | null;
  skillRuntimeOverride?: SkillRuntimeContext;
};

export type ResolvedRunContext = {
  resolvedAgent: Agent | null;
  lastUserPrompt: string | null;
  memoryContext: string;
  skillRuntime: SkillRuntimeContext;
  brandResolution: Awaited<ReturnType<typeof resolveAgentBrandRuntime>>['brandResolution'];
  activeBrand: Awaited<ReturnType<typeof resolveAgentBrandRuntime>>['activeBrand'];
  resolvedDomainContext: ResolvedDomainContext | null;
  resolvedDomainContextBlock: string;
  resolvedDomainSetupBlock: string;
};

function getDomainProfileOwnerContext(
  request: AgentRunRequest,
  lineChannelId?: string,
): DomainProfileOwnerContext | null {
  if (request.identity.userId) {
    return {
      userId: request.identity.userId,
    };
  }

  if (
    request.identity.channel === 'line'
    && request.identity.lineUserId
    && lineChannelId
  ) {
    return {
      lineUserId: request.identity.lineUserId,
      channelId: lineChannelId,
    };
  }

  return null;
}

export async function resolveRunDomainContext(input: {
  request: AgentRunRequest;
  lineChannelId?: string;
  userMessage: string | null;
}): Promise<ResolvedDomainContext | null> {
  const owner = getDomainProfileOwnerContext(input.request, input.lineChannelId);
  if (!owner) {
    return null;
  }

  const { resolveRelevantDomainContext } = await import('@/features/domain-profiles/service');
  return resolveRelevantDomainContext(
    {
      userMessage: input.userMessage ?? undefined,
      profileLimit: 10,
      entityLimit: 8,
    },
    owner,
  );
}

export async function resolveRunContext(input: {
  request: AgentRunRequest;
  channelContext: PreparedAgentRunChannelContextOverrides;
}): Promise<ResolvedRunContext> {
  const { request, channelContext } = input;

  const [agentRows, memoryContextOverride] = await Promise.all([
    channelContext.agentOverride !== undefined
      ? Promise.resolve(channelContext.agentOverride ? [channelContext.agentOverride] : [])
      : request.agentId
        ? db.select().from(agent).where(eq(agent.id, request.agentId)).limit(1)
        : Promise.resolve([]),
    channelContext.memoryContext !== undefined
      ? Promise.resolve(channelContext.memoryContext)
      : request.policy.allowMemoryRead && request.identity.userId
        ? getUserMemoryContext(request.identity.userId)
        : Promise.resolve(''),
  ]);

  const resolvedAgent = (agentRows[0] ?? null) as Agent | null;
  const lastUserPrompt = getLastUserPromptFromRunMessages(request.messages);
  const [resolvedSkillRuntime, brandRuntime, resolvedDomainContext] = await Promise.all([
    channelContext.skillRuntimeOverride !== undefined
      ? Promise.resolve(channelContext.skillRuntimeOverride)
      : resolveAgentSkillRuntime(resolvedAgent, lastUserPrompt),
    resolveAgentBrandRuntime({
      userId: request.identity.billingUserId,
      activeBrandId: request.activeBrandId ?? null,
      agent: resolvedAgent,
      enabled: true,
    }),
    channelContext.domainContextBlock !== undefined
      ? Promise.resolve(null)
      : resolveRunDomainContext({
          request,
          lineChannelId: channelContext.lineChannelId,
          userMessage: lastUserPrompt,
        }),
  ]);

  const skillRuntime = resolvedSkillRuntime ?? EMPTY_SKILL_RUNTIME;
  const { brandResolution, activeBrand } = brandRuntime;
  const resolvedDomainContextBlock = channelContext.domainContextBlock
    ?? renderDomainContextPromptBlock(resolvedDomainContext);
  const resolvedDomainSetupBlock = channelContext.domainSetupBlock
    ?? buildDomainSetupPromptBlock({
      userMessage: lastUserPrompt,
      context: resolvedDomainContext,
      skillRuntime,
    });

  return {
    resolvedAgent,
    lastUserPrompt,
    memoryContext: memoryContextOverride ?? '',
    skillRuntime,
    brandResolution,
    activeBrand,
    resolvedDomainContext,
    resolvedDomainContextBlock,
    resolvedDomainSetupBlock,
  };
}
