import type { Brand } from '@/features/brands/types';
import type { SkillRuntimeContext } from '@/features/skills/server/activation';
import type { AgentRunRequest } from './run-types';
import {
  buildResolvedPromptContext,
  type ResolvedPromptContext,
} from '@/features/chat/server/prompt-context';

export function buildChannelResponseBlock(request: Pick<AgentRunRequest, 'policy'>): string {
  if (request.policy.responseFormat !== 'plain_text') return '';

  return '\n\n<channel_response_format>\n'
    + 'IMPORTANT: You are replying in a plain-text channel. '
    + 'Do not use markdown syntax, code fences, tables, or HTML. '
    + 'Keep formatting minimal and use plain sentences or simple bullet points only.\n'
    + '</channel_response_format>';
}

export function buildPreparedRunPrompt(input: {
  request: AgentRunRequest;
  baseSystemPrompt: string;
  activeBrand: Brand | null;
  memoryContext: string;
  effectiveDocumentIds?: string[];
  skillRuntime: SkillRuntimeContext;
  supportsTools: boolean;
  channelContext: {
    conversationSummaryBlock?: string;
    threadWorkingMemoryBlock?: string;
    sharedMemoryBlock?: string;
    domainContextBlock?: string;
    domainSetupBlock?: string;
    examPrepBlock?: string;
    certBlock?: string;
    quizContextBlock?: string;
    extraBlocks?: Array<string | null | undefined>;
  };
  brandPromptInstruction?: string | null;
}): ResolvedPromptContext {
  const {
    request,
    baseSystemPrompt,
    activeBrand,
    memoryContext,
    effectiveDocumentIds,
    skillRuntime,
    supportsTools,
    channelContext,
    brandPromptInstruction,
  } = input;

  return buildResolvedPromptContext({
    base: baseSystemPrompt,
    conversationSummaryBlock: channelContext.conversationSummaryBlock ?? '',
    threadWorkingMemoryBlock: channelContext.threadWorkingMemoryBlock ?? '',
    isGrounded: Boolean(effectiveDocumentIds?.length),
    activeBrand,
    memoryContext,
    sharedMemoryBlock: channelContext.sharedMemoryBlock ?? '',
    domainContextBlock: channelContext.domainContextBlock ?? '',
    domainSetupBlock: channelContext.domainSetupBlock ?? '',
    skillRuntime,
    examPrepBlock: channelContext.examPrepBlock ?? '',
    certBlock: channelContext.certBlock ?? '',
    quizContextBlock: supportsTools ? (channelContext.quizContextBlock ?? '') : '',
    brandPromptInstruction,
    extraBlocks: [...(channelContext.extraBlocks ?? []), buildChannelResponseBlock(request)],
  });
}
