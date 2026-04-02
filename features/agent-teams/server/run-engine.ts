/**
 * Sequential and planner-generated team run execution engine.
 *
 * Sequential flow (routingStrategy = 'sequential'):
 *   Specialists run in position order; sub-prompts built from prior context.
 *
 * Planner-generated flow (routingStrategy = 'planner_generated'):
 *   Orchestrator produces a JSON execution plan first, selecting which
 *   specialists to involve and providing focused sub-prompts for each.
 *   The plan step itself is persisted and credited before specialists run.
 *
 * Both strategies share the same step-execution loop and synthesis step.
 */

import { generateText } from 'ai';
import type { ToolSet } from 'ai';
import { getCreditCost, getUserBalance, deductCredits } from '@/lib/credits';
import { buildToolSet } from '@/lib/tools';
import { toolDisabledModels } from '@/features/chat/server/routing';
import {
  createTeamRun,
  updateTeamRun,
  createTeamRunStep,
  updateTeamRunStep,
} from './queries';
import {
  resolveAgentModel,
  buildSpecialistPrompt,
  buildContextBlock,
  generateStepSummary,
  inferArtifactType,
  synthesizeWithOrchestrator,
  generatePlan,
  type StepContext,
} from './orchestrator';
import type {
  AgentTeamWithMembers,
  AgentTeamMemberWithAgent,
  OrchestratorPlan,
  TeamRunRow,
  TeamRunStatusUpdate,
  ArtifactType,
} from '../types';

// ── Public types ──────────────────────────────────────────────────────────────

export type ExecuteTeamRunParams = {
  team: AgentTeamWithMembers;
  userId: string;
  userPrompt: string;
  threadId?: string | null;
  onUpdate: (update: TeamRunStatusUpdate) => void;
  /** Pre-approved plan (from plan-preview flow) — skips the planning LLM call */
  approvedPlan?: OrchestratorPlan;
};

export type ExecuteTeamRunResult = {
  run: TeamRunRow;
  finalOutput: string;
};

/** Estimate the maximum credit cost for a run (all members × their model cost). */
export function estimateRunCost(team: AgentTeamWithMembers): number {
  return team.members.reduce((total, m) => {
    const modelId = resolveAgentModel(m.agent.modelId);
    return total + getCreditCost(modelId);
  }, 0);
}

// ── Internal types ────────────────────────────────────────────────────────────

/** Resolved execution step — same shape regardless of routing strategy. */
type ResolvedStep = {
  member: AgentTeamMemberWithAgent;
  /** Null = build dynamically from context (sequential). Non-null = from plan. */
  subPrompt: string | null;
  /** Null = infer from member tags (sequential). Non-null = from plan. */
  plannedArtifactType: ArtifactType | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitMembers(team: AgentTeamWithMembers): {
  orchestrator: AgentTeamMemberWithAgent;
  specialists: AgentTeamMemberWithAgent[];
} {
  const orchestrator = team.members.find((m) => m.role === 'orchestrator');
  if (!orchestrator) throw new TeamRunError(`Team "${team.name}" has no orchestrator member.`, 'unknown');

  const specialists = team.members
    .filter((m) => m.role === 'specialist')
    .sort((a, b) => a.position - b.position);

  if (specialists.length === 0) throw new TeamRunError(`Team "${team.name}" has no specialist members.`, 'unknown');

  return { orchestrator, specialists };
}

// ── Main execution function ───────────────────────────────────────────────────

export async function executeTeamRun(params: ExecuteTeamRunParams): Promise<ExecuteTeamRunResult> {
  const { team, userId, userPrompt, threadId, onUpdate, approvedPlan } = params;
  const config = team.config ?? {};
  const maxSteps = config.maxSteps ?? 5;
  const isPlanner = team.routingStrategy === 'planner_generated';

  // ── 1. Validate ────────────────────────────────────────────────────────────
  const { orchestrator, specialists } = splitMembers(team);

  // ── 2. Credit pre-check ────────────────────────────────────────────────────
  const estimatedCost = estimateRunCost(team);
  const balance = await getUserBalance(userId);
  if (balance < estimatedCost) {
    throw new TeamRunError(
      `Insufficient credits. Estimated cost: ${estimatedCost}, balance: ${balance}.`,
      'insufficient_credits',
    );
  }

  // ── 3. Create run row ──────────────────────────────────────────────────────
  const run = await createTeamRun({
    teamId: team.id,
    userId,
    threadId: threadId ?? null,
    inputPrompt: userPrompt,
    budgetCredits: config.budgetCredits ?? null,
  });

  let totalSpent = 0;
  // Running index for step rows (shared across planning + specialist + synthesis steps)
  let stepIndex = 0;

  try {
    // ── 4. Build execution plan ────────────────────────────────────────────
    let resolvedSteps: ResolvedStep[];
    let synthesisInstruction: string | undefined;

    if (isPlanner) {
      // ── 4a. Planner path: orchestrator generates the step plan ────────────
      const planStepRow = await createTeamRunStep({
        runId: run.id,
        memberId: orchestrator.id,
        agentId: orchestrator.agentId,
        agentName: orchestrator.agent.name,
        role: 'orchestrator',
        stepIndex: stepIndex++,
        inputPrompt: `Plan the execution for: ${userPrompt}`,
      });

      const orchestratorModelId = resolveAgentModel(orchestrator.agent.modelId);
      const planCreditCost = getCreditCost(orchestratorModelId);

      // Budget guard for planning step
      if (config.budgetCredits != null && totalSpent + planCreditCost > config.budgetCredits) {
        throw new TeamRunError('Run aborted: budget limit reached before planning.', 'budget_exceeded');
      }

      let planResult: Awaited<ReturnType<typeof generatePlan>>;

      if (approvedPlan) {
        // Use the pre-approved plan — skip the planning LLM call and credit charge
        planResult = {
          plan: approvedPlan,
          modelId: resolveAgentModel(orchestrator.agent.modelId),
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
      }

      if (!approvedPlan) {
        const planSummary = `Planned ${planResult.plan.steps.length} step(s): ${planResult.plan.steps.map((s) => {
          const m = specialists.find((sp) => sp.id === s.memberId);
          return m ? (m.displayRole ?? m.agent.name) : s.memberId;
        }).join(' → ')}`;

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

      synthesisInstruction = planResult.plan.synthesisInstruction;

      // Resolve plan steps to member objects (capped at maxSteps)
      resolvedSteps = planResult.plan.steps
        .slice(0, maxSteps)
        .map((s) => ({
          member: specialists.find((m) => m.id === s.memberId)!,
          subPrompt: s.subPrompt,
          plannedArtifactType: s.artifactType,
        }))
        .filter((s) => s.member != null);
    } else {
      // ── 4b. Sequential path: run all specialists in position order ─────────
      resolvedSteps = specialists.slice(0, maxSteps).map((m) => ({
        member: m,
        subPrompt: null,
        plannedArtifactType: null,
      }));
    }

    // ── 5. Execute each resolved step ──────────────────────────────────────
    const priorStepContexts: StepContext[] = [];
    const synthesisSteps: Parameters<typeof synthesizeWithOrchestrator>[0]['steps'] = [];

    for (let i = 0; i < resolvedSteps.length; i++) {
      const { member, subPrompt: plannedSubPrompt, plannedArtifactType } = resolvedSteps[i]!;
      const modelId = resolveAgentModel(member.agent.modelId);
      const creditCost = getCreditCost(modelId);

      // Budget guard
      if (config.budgetCredits != null && totalSpent + creditCost > config.budgetCredits) {
        await updateTeamRun(run.id, {
          status: 'failed',
          errorMessage: `Budget limit of ${config.budgetCredits} credits reached after ${i} step(s).`,
          spentCredits: totalSpent,
          completedAt: new Date(),
        });
        onUpdate({ type: 'run_error', runId: run.id, error: 'Budget limit reached.' });
        throw new TeamRunError('Run aborted: budget limit reached.', 'budget_exceeded');
      }

      const currentStepIndex = stepIndex++;

      const stepRow = await createTeamRunStep({
        runId: run.id,
        memberId: member.id,
        agentId: member.agentId,
        agentName: member.agent.name,
        role: 'specialist',
        stepIndex: currentStepIndex,
        inputPrompt: plannedSubPrompt ?? userPrompt,
      });

      onUpdate({
        type: 'step_start',
        runId: run.id,
        stepIndex: currentStepIndex,
        memberId: member.id,
        agentId: member.agentId,
        agentName: member.agent.name,
        displayRole: member.displayRole,
      });

      // Build the prompt: use plan's sub-prompt if available, else build from context
      const subPrompt = plannedSubPrompt
        ? buildContextBlock(priorStepContexts)
            ? `${buildContextBlock(priorStepContexts)}\n\n${plannedSubPrompt}`
            : plannedSubPrompt
        : buildSpecialistPrompt({ userPrompt, member, priorSteps: priorStepContexts });

      const specialistSystemPrompt = member.agent.systemPrompt;

      // Build tool set for this specialist — empty if model doesn't support tools
      const specialistTools: ToolSet = (() => {
        if (toolDisabledModels.has(modelId)) return {};
        const enabledIds = member.agent.enabledTools;
        if (!enabledIds || enabledIds.length === 0) return {};
        return buildToolSet({ enabledToolIds: enabledIds, userId, source: 'agent' });
      })();
      const hasTools = Object.keys(specialistTools).length > 0;

      let output = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let stepError: string | undefined;

      try {
        const result = await generateText({
          model: modelId as Parameters<typeof generateText>[0]['model'],
          system: specialistSystemPrompt,
          prompt: subPrompt,
          ...(hasTools && { tools: specialistTools, maxSteps: 5 }),
        });
        output = result.text;
        promptTokens = result.usage?.inputTokens ?? 0;
        completionTokens = result.usage?.outputTokens ?? 0;
      } catch (err) {
        stepError = err instanceof Error ? err.message : String(err);
        console.error(`[team-run] step ${currentStepIndex} failed for "${member.agent.name}"`, err);
      }

      const artifactType: ArtifactType = plannedArtifactType ?? (stepError ? 'other' : inferArtifactType(member));
      const summary = stepError ? `[Step failed: ${stepError}]` : generateStepSummary(output);

      if (!stepError) {
        await deductCredits({
          userId,
          amount: creditCost,
          description: `Team run step: "${member.agent.name}" in team "${team.name}"`,
        });
        totalSpent += creditCost;
      }

      await updateTeamRunStep(stepRow.id, {
        status: stepError ? 'failed' : 'completed',
        output: stepError ? undefined : output,
        summary,
        artifactType,
        modelId,
        promptTokens,
        completionTokens,
        creditCost: stepError ? 0 : creditCost,
        errorMessage: stepError,
        completedAt: new Date(),
      });

      await updateTeamRun(run.id, { spentCredits: totalSpent });

      onUpdate({
        type: 'step_complete',
        runId: run.id,
        stepIndex: currentStepIndex,
        memberId: member.id,
        agentId: member.agentId,
        agentName: member.agent.name,
        displayRole: member.displayRole,
        summary,
        artifactType,
      });

      if (!stepError) {
        priorStepContexts.push({ agentName: member.agent.name, displayRole: member.displayRole, summary, artifactType });
        synthesisSteps.push({ agentName: member.agent.name, displayRole: member.displayRole, artifactType, output });
      }
    }

    // ── 6. Orchestrator synthesis ──────────────────────────────────────────
    const orchestratorModelId = resolveAgentModel(orchestrator.agent.modelId);
    const synthesisCreditCost = getCreditCost(orchestratorModelId);

    const synthStepRow = await createTeamRunStep({
      runId: run.id,
      memberId: orchestrator.id,
      agentId: orchestrator.agentId,
      agentName: orchestrator.agent.name,
      role: 'orchestrator',
      stepIndex: stepIndex++,
      inputPrompt: synthesisInstruction ?? `Synthesize the team's work into a final answer for: ${userPrompt}`,
    });

    let finalOutput = '';
    let synthPromptTokens = 0;
    let synthCompletionTokens = 0;
    let synthError: string | undefined;

    try {
      const synthesis = await synthesizeWithOrchestrator({
        orchestratorMember: orchestrator,
        userPrompt,
        steps: synthesisSteps,
        outputFormat: config.outputFormat,
        outputContract: config.outputContract,
        contractSections: config.contractSections,
        synthesisInstruction,
      });
      finalOutput = synthesis.text;
      synthPromptTokens = synthesis.promptTokens;
      synthCompletionTokens = synthesis.completionTokens;
    } catch (err) {
      synthError = err instanceof Error ? err.message : String(err);
      console.error('[team-run] synthesis step failed', err);
      finalOutput = synthesisSteps
        .map((s) => `## ${s.displayRole ?? s.agentName}\n\n${s.output}`)
        .join('\n\n---\n\n');
    }

    if (!synthError) {
      await deductCredits({
        userId,
        amount: synthesisCreditCost,
        description: `Team run synthesis: "${orchestrator.agent.name}" in team "${team.name}"`,
      });
      totalSpent += synthesisCreditCost;
    }

    await updateTeamRunStep(synthStepRow.id, {
      status: synthError ? 'failed' : 'completed',
      output: finalOutput,
      summary: generateStepSummary(finalOutput),
      artifactType: 'other',
      modelId: orchestratorModelId,
      promptTokens: synthPromptTokens,
      completionTokens: synthCompletionTokens,
      creditCost: synthError ? 0 : synthesisCreditCost,
      errorMessage: synthError,
      completedAt: new Date(),
    });

    // ── 7. Finalise run ────────────────────────────────────────────────────
    await updateTeamRun(run.id, {
      status: 'completed',
      finalOutput,
      spentCredits: totalSpent,
      completedAt: new Date(),
    });

    onUpdate({ type: 'run_complete', runId: run.id });

    return { run, finalOutput };
  } catch (err) {
    if (!(err instanceof TeamRunError)) {
      const msg = err instanceof Error ? err.message : String(err);
      await updateTeamRun(run.id, {
        status: 'failed',
        spentCredits: totalSpent,
        errorMessage: msg,
        completedAt: new Date(),
      });
      onUpdate({ type: 'run_error', runId: run.id, error: msg });
    }
    throw err;
  }
}

// ── Custom error type ─────────────────────────────────────────────────────────

export class TeamRunError extends Error {
  constructor(
    message: string,
    public readonly code: 'insufficient_credits' | 'budget_exceeded' | 'no_specialists' | 'unknown',
  ) {
    super(message);
    this.name = 'TeamRunError';
  }
}
