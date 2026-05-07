/**
 * Shared step-execution helpers used by both sequential-run.ts and planner-run.ts.
 *
 * executeSpecialistLoop  — runs a list of resolved steps, tracks credit spend, updates DB.
 * executeSynthesisStep   — calls the orchestrator to synthesize and persists the result.
 */

import { generateText } from 'ai';
import type { ToolSet } from 'ai';
import { getCreditCost, deductCredits } from '@/lib/credits';
import { buildToolsForRun } from '@/features/agents/server/run-tools';
import { toolDisabledModels } from '@/features/chat/server/routing';
import { createTeamRunStep, updateTeamRunStep, updateTeamRun } from './queries';
import { resolveAgentModel, synthesizeWithOrchestrator } from './orchestrator';
import {
  buildContextBlock,
  buildSpecialistPrompt,
  generateStepSummary,
  inferArtifactType,
  type ResolvedStep,
  type StepContext,
  type SynthesisStep,
} from './specialist-helpers';
import type {
  AgentTeamMemberWithAgent,
  AgentTeamWithMembers,
  ArtifactType,
  TeamRunRow,
  TeamRunStatusUpdate,
} from '../types';

// ── Specialist execution loop ─────────────────────────────────────────────────

export type SpecialistLoopInput = {
  resolvedSteps: ResolvedStep[];
  team: AgentTeamWithMembers;
  userId: string;
  userPrompt: string;
  run: TeamRunRow;
  initialStepIndex: number;
  initialTotalSpent: number;
  onUpdate: (update: TeamRunStatusUpdate) => void;
};

export type SpecialistLoopResult = {
  synthesisSteps: SynthesisStep[];
  priorStepContexts: StepContext[];
  totalSpent: number;
  nextStepIndex: number;
};

/**
 * Execute a list of resolved specialist steps sequentially.
 * Returns accumulated synthesis inputs, credit spend, and the next step index.
 *
 * Step failure is recorded and logged but does NOT halt the loop —
 * downstream steps and synthesis continue without the failed step's output.
 */
export async function executeSpecialistLoop(
  input: SpecialistLoopInput,
): Promise<SpecialistLoopResult> {
  const { resolvedSteps, team, userId, userPrompt, run, onUpdate } = input;
  const config = team.config ?? {};
  let totalSpent = input.initialTotalSpent;
  let stepIndex = input.initialStepIndex;
  const priorStepContexts: StepContext[] = [];
  const synthesisSteps: SynthesisStep[] = [];

  for (let i = 0; i < resolvedSteps.length; i++) {
    const { member, subPrompt: plannedSubPrompt, plannedArtifactType } = resolvedSteps[i]!;
    const modelId = await resolveAgentModel(member.agent.modelId);
    const creditCost = getCreditCost(modelId);

    if (config.budgetCredits != null && totalSpent + creditCost > config.budgetCredits) {
      await updateTeamRun(run.id, {
        status: 'failed',
        errorMessage: `Budget limit of ${config.budgetCredits} credits reached after ${i} step(s).`,
        spentCredits: totalSpent,
        completedAt: new Date(),
      });
      onUpdate({ type: 'run_error', runId: run.id, error: 'Budget limit reached.' });
      throw new Error(`Budget limit of ${config.budgetCredits} credits reached.`);
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

    const subPrompt = plannedSubPrompt
      ? buildContextBlock(priorStepContexts)
          ? `${buildContextBlock(priorStepContexts)}\n\n${plannedSubPrompt}`
          : plannedSubPrompt
      : buildSpecialistPrompt({ userPrompt, member, priorSteps: priorStepContexts });

    const specialistTools: ToolSet = (() => {
      if (toolDisabledModels.has(modelId)) return {};
      const enabledIds = member.agent.enabledTools;
      if (!enabledIds || enabledIds.length === 0) return {};
      return buildToolsForRun({ enabledToolIds: enabledIds, userId, agentId: member.agent.id });
    })();
    const hasTools = Object.keys(specialistTools).length > 0;

    let output = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let stepError: string | undefined;

    try {
      const result = await generateText({
        model: modelId as Parameters<typeof generateText>[0]['model'],
        system: member.agent.systemPrompt,
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

    const artifactType: ArtifactType =
      plannedArtifactType ?? (stepError ? 'other' : inferArtifactType(member));
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

  return { synthesisSteps, priorStepContexts, totalSpent, nextStepIndex: stepIndex };
}

// ── Synthesis step ────────────────────────────────────────────────────────────

export type SynthesisStepInput = {
  orchestrator: AgentTeamMemberWithAgent;
  run: TeamRunRow;
  team: AgentTeamWithMembers;
  userId: string;
  userPrompt: string;
  synthesisSteps: SynthesisStep[];
  synthesisInstruction: string | undefined;
  stepIndex: number;
  totalSpent: number;
};

/**
 * Run the orchestrator synthesis step: LLM call → deduct credits → persist step row.
 * Falls back to concatenating specialist outputs when the LLM call fails.
 */
export async function executeSynthesisStep(
  input: SynthesisStepInput,
): Promise<{ finalOutput: string; totalSpent: number }> {
  const {
    orchestrator,
    run,
    team,
    userId,
    userPrompt,
    synthesisSteps,
    synthesisInstruction,
    stepIndex,
  } = input;
  let totalSpent = input.totalSpent;
  const config = team.config ?? {};

  const orchestratorModelId = await resolveAgentModel(orchestrator.agent.modelId);
  const synthesisCreditCost = getCreditCost(orchestratorModelId);

  const synthStepRow = await createTeamRunStep({
    runId: run.id,
    memberId: orchestrator.id,
    agentId: orchestrator.agentId,
    agentName: orchestrator.agent.name,
    role: 'orchestrator',
    stepIndex,
    inputPrompt:
      synthesisInstruction ??
      `Synthesize the team's work into a final answer for: ${userPrompt}`,
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

  return { finalOutput, totalSpent };
}
