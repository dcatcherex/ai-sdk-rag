/**
 * Sequential execution path: runs all specialists in position order,
 * each step receiving prior step summaries as context.
 */

import { updateTeamRun } from './queries';
import { executeSpecialistLoop, executeSynthesisStep } from './run-steps';
import type { TeamRunContext, ExecuteTeamRunResult } from './specialist-helpers';

export async function executeSequentialRun(ctx: TeamRunContext): Promise<ExecuteTeamRunResult> {
  const { run, orchestrator, specialists, team, userId, userPrompt, onUpdate, maxSteps } = ctx;

  // All specialists in position order; sub-prompts built dynamically from context.
  const resolvedSteps = specialists.slice(0, maxSteps).map((m) => ({
    member: m,
    subPrompt: null as string | null,
    plannedArtifactType: null as null,
  }));

  const { synthesisSteps, totalSpent: spentAfterSteps, nextStepIndex } =
    await executeSpecialistLoop({
      resolvedSteps,
      team,
      userId,
      userPrompt,
      run,
      initialStepIndex: 0,
      initialTotalSpent: 0,
      onUpdate,
    });

  const { finalOutput, totalSpent } = await executeSynthesisStep({
    orchestrator,
    run,
    team,
    userId,
    userPrompt,
    synthesisSteps,
    synthesisInstruction: undefined,
    stepIndex: nextStepIndex,
    totalSpent: spentAfterSteps,
  });

  await updateTeamRun(run.id, {
    status: 'completed',
    finalOutput,
    spentCredits: totalSpent,
    completedAt: new Date(),
  });

  onUpdate({ type: 'run_complete', runId: run.id });

  return { run, finalOutput };
}
