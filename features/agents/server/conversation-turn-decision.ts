import type { AgentRunPolicy } from './run-types';
import { wantsImageGeneration } from './media-intent';

export type ConversationTurnExecutionMode = 'text' | 'direct_image';

export function resolveConversationTurnExecution(input: {
  policy: Pick<AgentRunPolicy, 'allowDirectImageGeneration'>;
  lastUserPrompt: string | null;
}): ConversationTurnExecutionMode {
  return input.policy.allowDirectImageGeneration
    && Boolean(input.lastUserPrompt)
    && wantsImageGeneration(input.lastUserPrompt ?? '')
    ? 'direct_image'
    : 'text';
}
