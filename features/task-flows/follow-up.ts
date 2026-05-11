import type { TaskFlowDefinition } from '@/features/task-flows/types';

export function getMissingRequiredTaskFlowSlots(
  flow: TaskFlowDefinition,
  slots: Record<string, unknown>,
): string[] {
  return flow.requiredSlots
    .filter((slot) => slot.required)
    .filter((slot) => {
      const value = slots[slot.key];
      if (typeof value === 'string') {
        return value.trim().length === 0;
      }
      return value === null || value === undefined;
    })
    .map((slot) => slot.key);
}

export function buildTaskFlowFollowUpQuestion(
  flow: TaskFlowDefinition,
  missingSlots: string[],
): string {
  const primarySlot = flow.requiredSlots.find((slot) => slot.key === missingSlots[0]);
  if (!primarySlot) {
    return 'Could you share a bit more detail so I can continue?';
  }

  if (!primarySlot.examples?.length) {
    return primarySlot.question;
  }

  const hasExamples = primarySlot.question.includes('เช่น') || primarySlot.question.toLowerCase().includes('for example');
  if (hasExamples) {
    return primarySlot.question;
  }

  return `${primarySlot.question} เช่น ${primarySlot.examples.slice(0, 3).join(', ')}`;
}
