import type { TaskFlowDefinition, TaskFlowIntentMatch, TaskFlowMessageState } from '@/features/task-flows/types';

type DetectTaskFlowIntentInput = {
  message: string;
  flows: TaskFlowDefinition[];
  state?: TaskFlowMessageState | null;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countTriggerHits(message: string, flow: TaskFlowDefinition) {
  const normalizedMessage = normalize(message);
  return flow.triggers.reduce((score, trigger) => {
    const normalizedTrigger = normalize(trigger);
    if (!normalizedTrigger) {
      return score;
    }

    if (normalizedMessage === normalizedTrigger) {
      return score + 1.2;
    }

    if (normalizedMessage.includes(normalizedTrigger)) {
      return score + 1;
    }

    const regex = new RegExp(`\\b${escapeRegex(normalizedTrigger)}\\b`, 'i');
    return regex.test(message) ? score + 0.8 : score;
  }, 0);
}

function hasNegativeTrigger(message: string, flow: TaskFlowDefinition) {
  const normalizedMessage = normalize(message);
  return flow.negativeTriggers?.some((trigger) => normalizedMessage.includes(normalize(trigger))) ?? false;
}

export function detectTaskFlowIntent(input: DetectTaskFlowIntentInput): TaskFlowIntentMatch {
  const trimmedMessage = input.message.trim();
  if (!trimmedMessage) {
    return { flow: null, confidence: 0, source: 'fallback' };
  }

  if (input.state?.status === 'needs_more_info') {
    const stateFlow = input.flows.find((flow) => flow.key === input.state?.flowKey);
    if (stateFlow) {
      return {
        flow: stateFlow,
        confidence: 0.94,
        source: 'state',
      };
    }
  }

  let bestMatch: TaskFlowIntentMatch = { flow: null, confidence: 0, source: 'fallback' };

  for (const flow of input.flows) {
    if (hasNegativeTrigger(trimmedMessage, flow)) {
      continue;
    }

    const triggerHits = countTriggerHits(trimmedMessage, flow);
    if (triggerHits <= 0) {
      continue;
    }

    const confidence = Math.min(0.55 + triggerHits * 0.18, 0.92);
    if (confidence > bestMatch.confidence) {
      bestMatch = {
        flow,
        confidence,
        source: 'rule',
      };
    }
  }

  return bestMatch;
}
