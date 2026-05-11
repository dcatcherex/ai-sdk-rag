import type { ChatMessage, ChatMessageMetadata } from '@/features/chat/types';
import {
  buildTaskFlowMessageState,
  buildTaskFlowReadyPromptBlock,
  resolveTaskFlow,
} from '@/features/task-flows/service';
import type { TaskFlowChannel, TaskFlowDecision } from '@/features/task-flows/types';

export async function resolveTaskFlowRuntime(input: {
  channel: TaskFlowChannel;
  lastUserPrompt: string | null | undefined;
  messages: ChatMessage[];
  activeSkillIds: string[];
  activeSkillNames: string[];
}): Promise<{
  locale: string;
  decision: TaskFlowDecision;
}> {
  const locale = /[ก-๙]/.test(input.lastUserPrompt ?? '') ? 'th-TH' : 'en-US';
  const decision = input.lastUserPrompt
    ? await resolveTaskFlow({
        channel: input.channel,
        message: input.lastUserPrompt,
        messages: input.messages,
        activeSkillIds: input.activeSkillIds,
        activeSkillNames: input.activeSkillNames,
        locale,
      })
    : { status: 'no_match' as const, confidence: 0, source: 'fallback' as const };

  return {
    locale,
    decision,
  };
}

export function buildNeedsMoreInfoIntercept(
  decision: Extract<TaskFlowDecision, { status: 'needs_more_info' }>,
): {
  assistantText: string;
  messageMetadata: ChatMessageMetadata;
} {
  return {
    assistantText: decision.followUpQuestion,
    messageMetadata: {
      taskFlow: buildTaskFlowMessageState(decision),
    },
  };
}

export function buildReadyTaskFlowMessageMetadata(
  decision: Extract<TaskFlowDecision, { status: 'ready' }>,
): ChatMessageMetadata {
  return {
    taskFlow: buildTaskFlowMessageState(decision),
  };
}

export function applyReadyTaskFlowPrompt(input: {
  baseSystemPrompt: string;
  decision: Extract<TaskFlowDecision, { status: 'ready' }> | null;
  locale: string;
}): string {
  if (!input.decision) {
    return input.baseSystemPrompt;
  }

  const taskFlowPromptBlock = buildTaskFlowReadyPromptBlock(input.decision, input.locale);
  if (!taskFlowPromptBlock) {
    return input.baseSystemPrompt;
  }

  return [input.baseSystemPrompt, taskFlowPromptBlock].filter(Boolean).join('\n\n');
}
