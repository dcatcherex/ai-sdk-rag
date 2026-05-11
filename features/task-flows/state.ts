import type { ChatMessage, ChatMessageMetadata } from '@/features/chat/types';
import type { TaskFlowMessageState } from '@/features/task-flows/types';

export function getLatestTaskFlowState(messages: ChatMessage[]): TaskFlowMessageState | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const metadata = messages[index]?.metadata as ChatMessageMetadata | undefined;
    if (metadata?.taskFlow) {
      return metadata.taskFlow;
    }
  }

  return null;
}

export function mergeTaskFlowSlots(
  previousSlots: Record<string, unknown>,
  nextSlots: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    [...Object.entries(previousSlots), ...Object.entries(nextSlots)].filter((entry) => {
      const [, value] = entry;
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return value !== null && value !== undefined;
    }),
  );
}
