/**
 * Planner execution path: orchestrator generates a structured step plan first,
 * then specialists execute their assigned sub-tasks with focused prompts.
 */

import { getCreditCost, deductCredits } from '@/lib/credits';
import { createTeamRunStep, updateTeamRunStep, updateTeamRun } from './queries';
import { resolveAgentModel, generatePlan } from './orchestrator';
import { executeSpecialistLoop, executeSynthesisStep } from './run-steps';
import {
  TeamRunError,
  type TeamRunContext,
  type ExecuteTeamRunResult,
} from './specialist-helpers';

export async function executePlannerRun(ctx: TeamRunContext): Promise<ExecuteTeamRunResult> {
  const {
    run,
    orchestrator,
    specialists,
    team,
    userId,
    userPrompt,
    onUpdate,
    approvedPlan,
    maxSteps,
  } = ctx;
  const config = team.config ?? {};

  let totalSpent = 0;
  let stepIndex = 0;

  // ── Plan step ──────────────────────────────────────────────────────────────
  const planStepRow = await createTeamRunStep({
    runId: run.id,
    memberId: orchestrator.id,
    agentId: orchestrator.agentId,
    agentName: orchestrator.agent.name,
    role: 'orchestrator',
    stepIndex: stepIndex++,
    inputPrompt: `Plan the execution for: ${userPrompt}`,
  });

  const orchestratorModelId = await resolveAgentModel(orchestrator.agent.modelId);
  const planCreditCost = getCreditCost(orchestratorModelId);

  if (config.budgetCredits != null && totalSpent + planCreditCost > config.budgetCredits) {
    throw new TeamRunError('Run aborted: budget limit reached before planning.', 'budget_exceeded');
  }

  let planResult: Awaited<ReturnType<typeof generatePlan>>;

  if (approvedPlan) {
    planResult = {
      plan: approvedPlan,
      modelId: orchestratorModelId,
      promptTokens: 0,
      completionTokens: 0,
      wasFallback: false,
    };
    await updateTeamRunStep(planStepRow.id, {
      status: 'completed',
      output: JSON.stringify(approvedPlan, null, 2),
      summary: `Using pre-approved plan with ${approvedPlan.steps.length} step(s).`,
      artifactType: 'other',
      completedAt: new Date(),
    });
  } else {
    try {
      planResult = await generatePlan({ orchestratorMember: orchestrator, userPrompt, specialists });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await updateTeamRunStep(planStepRow.id, {
        status: 'failed',
        errorMessage: msg,
        completedAt: new Date(),
      });
      throw new TeamRunError(`Planning step failed: ${msg}`, 'unknown');
    }

    await deductCredits({
      userId,
      amount: planCreditCost,
      description: `Team run planning: "${orchestrator.agent.name}" in team "${team.name}"`,
    });
    totalSpent += planCreditCost;

    const planSummary = `Planned ${planResult.plan.steps.length} step(s): ${planResult.plan.steps
      .map((s) => {
        const m = specialists.find((sp) => sp.id === s.memberId);
        return m ? (m.displayRole ?? m.agent.name) : s.memberId;
      })
      .join(' → ')}`;

    await updateTeamRunStep(planStepRow.id, {
      status: 'completed',
      output: JSON.stringify(planResult.plan, null, 2),
      summary: planSummary,
      artifactType: 'other',
      modelId: planResult.modelId,
      promptTokens: planResult.promptTokens,
      completionTokens: planResult.completionTokens,
      creditCost: planCreditCost,
      completedAt: new Date(),
    });
    await updateTeamRun(run.id, { spentCredits: totalSpent });
  }

  const synthesisInstruction = planResult.plan.synthesisInstruction;

  const resolvedSteps = planResult.plan.steps
    .slice(0, maxSteps)
    .map((s) => ({
      member: specialists.find((m) => m.id === s.memberId)!,
      subPrompt: s.subPrompt,
      plannedArtifactType: s.artifactType,
    }))
    .filter((s) => s.member != null);

  // ── Execute specialist steps ───────────────────────────────────────────────
  const {
    synthesisSteps,
    totalSpent: spentAfterSteps,
    nextStepIndex,
  } = await executeSpecialistLoop({
    resolvedSteps,
    team,
    userId,
    userPrompt,
    run,
    initialStepIndex: stepIndex,
    initialTotalSpent: totalSpent,
    onUpdate,
  });

  // ── Orchestrator synthesis ─────────────────────────────────────────────────
  const { finalOutput, totalSpent: finalTotalSpent } = await executeSynthesisStep({
    orchestrator,
    run,
    team,
    userId,
    userPrompt,
    synthesisSteps,
    synthesisInstruction,
    stepIndex: nextStepIndex,
    totalSpent: spentAfterSteps,
  });

  await updateTeamRun(run.id, {
    status: 'completed',
    finalOutput,
    spentCredits: finalTotalSpent,
    completedAt: new Date(),
  });

  onUpdate({ type: 'run_complete', runId: run.id });

  return { run, finalOutput };
}
