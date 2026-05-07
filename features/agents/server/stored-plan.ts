import type { ImprovementChange, ImprovementPlan } from '@/features/agents/types/optimizer';

function isImprovementPlan(value: unknown): value is ImprovementPlan {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'changes' in value &&
    Array.isArray((value as { changes?: unknown }).changes),
  );
}

function isImprovementChangeArray(value: unknown): value is ImprovementChange[] {
  return Array.isArray(value);
}

export function parseStoredImprovementPlan(
  stored: unknown,
  fallback: {
    agentId: string;
    scoreBefore: number;
    scoreAfter?: number | null;
  },
): ImprovementPlan | null {
  if (isImprovementPlan(stored)) {
    return stored;
  }

  if (isImprovementChangeArray(stored)) {
    return {
      agentId: fallback.agentId,
      estimatedScoreAfter: fallback.scoreAfter ?? fallback.scoreBefore,
      reasoning: '',
      changes: stored,
    };
  }

  return null;
}
