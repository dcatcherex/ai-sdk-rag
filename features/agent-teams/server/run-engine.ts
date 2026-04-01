/**
 * Sequential team run execution engine.
 *
 * Flow:
 *   1. Validate: must have exactly one orchestrator + at least one specialist
 *   2. Credit pre-check: estimate cost and verify balance covers it
 *   3. For each specialist in position order:
 *      a. Emit 'step_start' update
 *      b. Build sub-prompt with context from prior steps
 *      c. Call specialist via generateText
 *      d. Generate summary + infer artifact type
 *      e. Deduct credits, persist step row
 *      f. Emit 'step_complete' update
 *   4. Call orchestrator for synthesis
 *   5. Persist final output on teamRun, emit 'run_complete'
 *
 * Specialists cannot delegate (no recursion). V1 is sequential only.
 */

import { generateText } from 'ai';
import { nanoid } from 'nanoid';
import { getCreditCost, getUserBalance, deductCredits } from '@/lib/credits';
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
} from './orchestrator';
import type {
  AgentTeamWithMembers,
  AgentTeamMemberWithAgent,
  TeamRunRow,
  TeamRunStatusUpdate,
  ArtifactType,
} from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExecuteTeamRunParams = {
  team: AgentTeamWithMembers;
  userId: string;
  userPrompt: string;
  threadId?: string | null;
  onUpdate: (update: TeamRunStatusUpdate) => void;
};

export type ExecuteTeamRunResult = {
  run: TeamRunRow;
  finalOutput: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Estimate the maximum credit cost for a run (all members × their model cost). */
export function estimateRunCost(team: AgentTeamWithMembers): number {
  return team.members.reduce((total, m) => {
    const modelId = resolveAgentModel(m.agent.modelId);
    return total + getCreditCost(modelId);
  }, 0);
}

/** Split members into orchestrator (exactly one) and specialists (ordered by position). */
function splitMembers(team: AgentTeamWithMembers): {
  orchestrator: AgentTeamMemberWithAgent;
  specialists: AgentTeamMemberWithAgent[];
} {
  const orchestrator = team.members.find((m) => m.role === 'orchestrator');
  if (!orchestrator) throw new Error(`Team "${team.name}" has no orchestrator member.`);

  const specialists = team.members
    .filter((m) => m.role === 'specialist')
    .sort((a, b) => a.position - b.position);

  if (specialists.length === 0) throw new Error(`Team "${team.name}" has no specialist members.`);

  return { orchestrator, specialists };
}

// ── Main execution function ───────────────────────────────────────────────────

export async function executeTeamRun(params: ExecuteTeamRunParams): Promise<ExecuteTeamRunResult> {
  const { team, userId, userPrompt, threadId, onUpdate } = params;
  const config = team.config ?? {};
  const maxSteps = config.maxSteps ?? 5;

  // ── 1. Validate team structure ─────────────────────────────────────────────
  const { orchestrator, specialists } = splitMembers(team);
  const cappedSpecialists = specialists.slice(0, maxSteps);

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

  // Accumulated context passed to each downstream specialist
  const priorStepContexts: Parameters<typeof buildContextBlock>[0] = [];

  // Full outputs collected for final synthesis
  const synthesisSteps: Parameters<typeof synthesizeWithOrchestrator>[0]['steps'] = [];

  try {
    // ── 4. Execute each specialist in order ─────────────────────────────────
    for (let i = 0; i < cappedSpecialists.length; i++) {
      const member = cappedSpecialists[i]!;
      const modelId = resolveAgentModel(member.agent.modelId);
      const creditCost = getCreditCost(modelId);

      // Budget guard: abort if this step would exceed the run budget
      if (config.budgetCredits !== undefined && config.budgetCredits !== null) {
        if (totalSpent + creditCost > config.budgetCredits) {
          await updateTeamRun(run.id, {
            status: 'failed',
            errorMessage: `Budget limit of ${config.budgetCredits} credits reached after ${i} steps.`,
            spentCredits: totalSpent,
            completedAt: new Date(),
          });
          onUpdate({ type: 'run_error', runId: run.id, error: 'Budget limit reached.' });
          throw new TeamRunError('Run aborted: budget limit reached.', 'budget_exceeded');
        }
      }

      // Create step row (status = 'running')
      const stepRow = await createTeamRunStep({
        runId: run.id,
        memberId: member.id,
        agentId: member.agentId,
        agentName: member.agent.name,
        role: 'specialist',
        stepIndex: i,
        inputPrompt: userPrompt,
      });

      onUpdate({
        type: 'step_start',
        runId: run.id,
        stepIndex: i,
        memberId: member.id,
        agentId: member.agentId,
        agentName: member.agent.name,
        displayRole: member.displayRole,
      });

      // Build full system prompt for specialist
      const specialistSystemPrompt = member.agent.systemPrompt +
        (member.agent.documentIds.length > 0
          ? '\nIMPORTANT: Use the searchKnowledge tool to find relevant information before answering.'
          : '');

      // Build focused sub-prompt with prior context
      const subPrompt = buildSpecialistPrompt({
        userPrompt,
        member,
        priorSteps: priorStepContexts,
      });

      let output = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let stepError: string | undefined;

      try {
        const result = await generateText({
          model: modelId as Parameters<typeof generateText>[0]['model'],
          system: specialistSystemPrompt,
          prompt: subPrompt,
        });
        output = result.text;
        promptTokens = result.usage?.inputTokens ?? 0;
        completionTokens = result.usage?.outputTokens ?? 0;
      } catch (err) {
        stepError = err instanceof Error ? err.message : String(err);
        console.error(`[team-run] step ${i} failed for agent "${member.agent.name}"`, err);
      }

      const artifactType: ArtifactType = stepError ? 'other' : inferArtifactType(member);
      const summary = stepError ? `[Step failed: ${stepError}]` : generateStepSummary(output);

      // Deduct credits (even on step error — the model was called)
      if (!stepError) {
        await deductCredits({
          userId,
          amount: creditCost,
          description: `Team run step: "${member.agent.name}" in team "${team.name}"`,
        });
        totalSpent += creditCost;
      }

      // Update step row
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

      // Update running spend on run row
      await updateTeamRun(run.id, { spentCredits: totalSpent });

      onUpdate({
        type: 'step_complete',
        runId: run.id,
        stepIndex: i,
        memberId: member.id,
        agentId: member.agentId,
        agentName: member.agent.name,
        displayRole: member.displayRole,
        summary,
        artifactType,
      });

      // Accumulate context for next specialist (summaries only)
      if (!stepError) {
        priorStepContexts.push({
          agentName: member.agent.name,
          displayRole: member.displayRole,
          summary,
          artifactType,
        });

        synthesisSteps.push({
          agentName: member.agent.name,
          displayRole: member.displayRole,
          artifactType,
          output,
        });
      }
    }

    // ── 5. Orchestrator synthesis ────────────────────────────────────────────
    const orchestratorModelId = resolveAgentModel(orchestrator.agent.modelId);
    const synthesisCreditCost = getCreditCost(orchestratorModelId);

    const orchestratorStepRow = await createTeamRunStep({
      runId: run.id,
      memberId: orchestrator.id,
      agentId: orchestrator.agentId,
      agentName: orchestrator.agent.name,
      role: 'orchestrator',
      stepIndex: cappedSpecialists.length,
      inputPrompt: `Synthesize the team's work into a final answer for: ${userPrompt}`,
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
      });
      finalOutput = synthesis.text;
      synthPromptTokens = synthesis.promptTokens;
      synthCompletionTokens = synthesis.completionTokens;
    } catch (err) {
      synthError = err instanceof Error ? err.message : String(err);
      console.error('[team-run] synthesis step failed', err);
      // Fall back: concatenate step outputs
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

    await updateTeamRunStep(orchestratorStepRow.id, {
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

    // ── 6. Finalise run ──────────────────────────────────────────────────────
    await updateTeamRun(run.id, {
      status: 'completed',
      finalOutput,
      spentCredits: totalSpent,
      completedAt: new Date(),
    });

    onUpdate({ type: 'run_complete', runId: run.id });

    return { run, finalOutput };
  } catch (err) {
    // Catch-all: mark run as failed if not already handled
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
