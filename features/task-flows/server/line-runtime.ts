import type { ChatMessage } from '@/features/chat/types';
import {
  buildNeedsMoreInfoIntercept,
  buildReadyTaskFlowMessageMetadata,
  resolveTaskFlowRuntime,
} from '@/features/task-flows/server/runtime';

export async function resolveLineTaskFlowAction(input: {
  lastUserPrompt: string;
  messages: ChatMessage[];
  activeSkillIds: string[];
  activeSkillNames: string[];
}): Promise<
  | {
      kind: 'none';
    }
  | {
      kind: 'follow_up';
      assistantText: string;
      assistantMetadata: Record<string, unknown>;
    }
  | {
      kind: 'ready';
      flowKey: string;
      locale: string;
      taskFlowDecision: Extract<Awaited<ReturnType<typeof resolveTaskFlowRuntime>>['decision'], { status: 'ready' }>;
      assistantMetadata: Record<string, unknown>;
    }
> {
  const runtime = await resolveTaskFlowRuntime({
    channel: 'line',
    lastUserPrompt: input.lastUserPrompt,
    messages: input.messages,
    activeSkillIds: input.activeSkillIds,
    activeSkillNames: input.activeSkillNames,
  });

  const { locale, decision } = runtime;
  if (decision.status === 'needs_more_info') {
    const intercept = buildNeedsMoreInfoIntercept(decision);
    return {
      kind: 'follow_up',
      assistantText: intercept.assistantText,
      assistantMetadata: intercept.messageMetadata,
    };
  }

  if (decision.status === 'ready') {
    return {
      kind: 'ready',
      flowKey: decision.flowKey,
      locale,
      taskFlowDecision: decision,
      assistantMetadata: buildReadyTaskFlowMessageMetadata(decision),
    };
  }

  return { kind: 'none' };
}
