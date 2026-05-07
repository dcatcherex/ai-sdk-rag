/**
 * Team run dispatcher.
 * Validates, charges a credit pre-check, creates the run row, then delegates
 * to executeSequentialRun or executePlannerRun.
 */

import { getCreditCost, getUserBalance } from '@/lib/credits';
import { createTeamRun, updateTeamRun } from './queries';
import { resolveAgentModel } from './orchestrator';
import { executeSequentialRun } from './sequential-run';
import { executePlannerRun } from './planner-run';
import {
  TeamRunError,
  type TeamRunContext,
  type ExecuteTeamRunResult,
} from './specialist-helpers';
import type {
  AgentTeamMemberWithAgent,
  AgentTeamWithMembers,
  OrchestratorPlan,
  TeamRunStatusUpdate,
} from '../types';

export { TeamRunError, type ExecuteTeamRunResult };

// ── Public types ──────────────────────────────────────────────────────────────

export type ExecuteTeamRunParams = {
  team: AgentTeamWithMembers;
  userId: string;
  userPrompt: string;
  threadId?: string | null;
  onUpdate: (update: TeamRunStatusUpdate) => void;
  approvedPlan?: OrchestratorPlan;
};

// ── Credit estimate ───────────────────────────────────────────────────────────

export async function estimateRunCost(team: AgentTeamWithMembers): Promise<number> {
  let total = 0;
  for (const m of team.members) {
    const modelId = await resolveAgentModel(m.agent.modelId);
    total += getCreditCost(modelId);
  }
  return total;
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export async function executeTeamRun(params: ExecuteTeamRunParams): Promise<ExecuteTeamRunResult> {
  const { team, userId, userPrompt, threadId, onUpdate, approvedPlan } = params;
  const config = team.config ?? {};

  const orchestrator = team.members.find((m) => m.role === 'orchestrator');
  if (!orchestrator) throw new TeamRunError(`Team "${team.name}" has no orchestrator member.`, 'unknown');

  const specialists = team.members
    .filter((m) => m.role === 'specialist')
    .sort((a, b) => a.position - b.position);
  if (specialists.length === 0) throw new TeamRunError(`Team "${team.name}" has no specialist members.`, 'unknown');

  const estimatedCost = await estimateRunCost(team);
  const balance = await getUserBalance(userId);
  if (balance < estimatedCost) {
    throw new TeamRunError(
      `Insufficient credits. Estimated cost: ${estimatedCost}, balance: ${balance}.`,
      'insufficient_credits',
    );
  }

  const run = await createTeamRun({
    teamId: team.id,
    userId,
    threadId: threadId ?? null,
    inputPrompt: userPrompt,
    budgetCredits: config.budgetCredits ?? null,
  });

  const ctx: TeamRunContext = {
    run, orchestrator, specialists, team, userId, userPrompt, onUpdate, approvedPlan,
    maxSteps: config.maxSteps ?? 5,
  };

  try {
    return team.routingStrategy === 'planner_generated'
      ? await executePlannerRun(ctx)
      : await executeSequentialRun(ctx);
  } catch (err) {
    if (!(err instanceof TeamRunError)) {
      const msg = err instanceof Error ? err.message : String(err);
      await updateTeamRun(run.id, {
        status: 'failed',
        spentCredits: 0,
        errorMessage: msg,
        completedAt: new Date(),
      });
      onUpdate({ type: 'run_error', runId: run.id, error: msg });
    }
    throw err;
  }
}
