/**
 * Orchestration utilities for multi-agent team runs.
 *
 * Responsibilities:
 *  - Resolve which model an agent should use
 *  - Synthesize a final answer by calling the orchestrator agent
 *  - Generate a structured execution plan (planner path)
 */

import { generateText } from 'ai';
import { availableModels, chatModel as HARDCODED_CHAT_MODEL } from '@/lib/ai';
import { getModelSlot } from '@/lib/ai-config';
import type { AgentTeamMemberWithAgent, ArtifactType, OrchestratorPlan } from '../types';
import {
  inferArtifactType,
  type SynthesisStep,
} from './specialist-helpers';

// ── Model resolution ──────────────────────────────────────────────────────────

/**
 * Resolve which model to use for an agent.
 * Falls back to the app default if the agent's model is unset or not in the
 * available list (handles model deprecations gracefully).
 */
export async function resolveAgentModel(agentModelId: string | null | undefined): Promise<string> {
  if (agentModelId && availableModels.some((m) => m.id === agentModelId)) {
    return agentModelId;
  }
  return await getModelSlot('chatModel') ?? HARDCODED_CHAT_MODEL;
}

// ── Output contract hint ──────────────────────────────────────────────────────

function buildContractHint(
  outputContract?: 'markdown' | 'json' | 'sections',
  contractSections?: string[],
  outputFormat?: 'markdown' | 'json',
): string {
  if (outputContract === 'json') {
    return '\n\nOutput must be a single valid JSON object with no markdown wrapping.';
  }
  if (outputContract === 'sections') {
    const sections =
      contractSections && contractSections.length > 0
        ? contractSections
        : ['Summary', 'Key Findings', 'Recommendations'];
    const headings = sections.map((s) => `## ${s}`).join('\n');
    return `\n\nStructure your output as exactly these named sections in order:\n${headings}\n\nDo not add sections beyond those listed.`;
  }
  // 'markdown' contract or legacy outputFormat fallback
  if (outputFormat === 'json') return '\n\nOutput must be valid JSON.';
  return '\n\nFormat your response in clear Markdown.';
}

export async function synthesizeWithOrchestrator(params: {
  orchestratorMember: AgentTeamMemberWithAgent;
  userPrompt: string;
  steps: SynthesisStep[];
  outputFormat?: 'markdown' | 'json';
  outputContract?: 'markdown' | 'json' | 'sections';
  contractSections?: string[];
  /** Optional instruction from the planner step — overrides the default synthesis prompt. */
  synthesisInstruction?: string;
}): Promise<{ text: string; modelId: string; promptTokens: number; completionTokens: number }> {
  const {
    orchestratorMember,
    userPrompt,
    steps,
    outputFormat,
    outputContract,
    contractSections,
    synthesisInstruction,
  } = params;

  const modelId = await resolveAgentModel(orchestratorMember.agent.modelId);

  const researchBlock = steps
    .map((s) => {
      const label = s.displayRole ?? s.agentName;
      return `<specialist role="${label}" type="${s.artifactType}">\n${s.output}\n</specialist>`;
    })
    .join('\n\n');

  const formatHint = buildContractHint(outputContract, contractSections, outputFormat);

  const closingInstruction = synthesisInstruction
    ? `\n\nSynthesis instruction from your planning step:\n${synthesisInstruction}`
    : `\n\nNow write the final, polished deliverable that directly addresses the user's request. Combine the team's work coherently — do not just concatenate their outputs.`;

  const synthesisPrompt = `You are synthesizing the work of your specialist team into a final deliverable.

Original request from the user:
${userPrompt}

Work produced by your team:
${researchBlock}${closingInstruction}${formatHint}`;

  const result = await generateText({
    model: modelId as Parameters<typeof generateText>[0]['model'],
    system: orchestratorMember.agent.systemPrompt,
    prompt: synthesisPrompt,
  });

  return {
    text: result.text,
    modelId,
    promptTokens: result.usage?.inputTokens ?? 0,
    completionTokens: result.usage?.outputTokens ?? 0,
  };
}

// ── Planner ───────────────────────────────────────────────────────────────────

const ARTIFACT_TYPE_VALUES =
  'research_brief | ad_copy | analysis | creative_direction | strategy | content | other';

/**
 * Ask the orchestrator to produce a structured execution plan.
 *
 * The orchestrator receives the user prompt and a list of available specialists,
 * and returns a JSON `OrchestratorPlan` specifying which agents to call, in what
 * order, and with what focused sub-prompts.
 *
 * Output is parsed from raw text (markdown fences stripped) and validated so that
 * only memberIds present in `specialists` are kept.
 */
export async function generatePlan(params: {
  orchestratorMember: AgentTeamMemberWithAgent;
  userPrompt: string;
  specialists: AgentTeamMemberWithAgent[];
}): Promise<{
  plan: OrchestratorPlan;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  wasFallback: boolean;
}> {
  const { orchestratorMember, userPrompt, specialists } = params;
  const modelId = await resolveAgentModel(orchestratorMember.agent.modelId);

  const specialistList = specialists
    .map((s) => {
      const role = s.displayRole ?? s.agent.name;
      const desc = (s.agent.description ?? s.agent.systemPrompt).slice(0, 200).replace(/\n/g, ' ');
      return `- memberId: "${s.id}"\n  role: "${role}"\n  description: "${desc}"`;
    })
    .join('\n\n');

  const planPrompt = `You are the orchestrator for a multi-agent team. Plan which specialists to involve for the user's request and what each should produce.

User request:
${userPrompt}

Available specialists:
${specialistList}

Return ONLY a valid JSON object with this exact structure (no markdown fences, no extra text):
{
  "steps": [
    {
      "memberId": "<exact memberId from above>",
      "subPrompt": "<specific, actionable task for this specialist>",
      "artifactType": "<one of: ${ARTIFACT_TYPE_VALUES}>",
      "usesPreviousSteps": ["<memberId of earlier steps this depends on>"],
      "reasoning": "<one sentence explaining why this specialist is included>"
    }
  ],
  "synthesisInstruction": "<how to combine the team outputs into the final deliverable>"
}

Rules:
- Only include specialists genuinely needed for this request
- Order steps so that dependencies come before the steps that use them
- Omit specialists that add no value for this specific request
- Keep subPrompts focused and specific to each role`;

  const result = await generateText({
    model: modelId as Parameters<typeof generateText>[0]['model'],
    system: orchestratorMember.agent.systemPrompt,
    prompt: planPrompt,
  });

  // Strip markdown fences if the model wrapped its output
  let raw = result.text.trim();
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) raw = fenceMatch[1]!.trim();

  let plan: OrchestratorPlan;
  let wasFallback = false;
  try {
    plan = JSON.parse(raw) as OrchestratorPlan;
  } catch {
    // If parsing fails, fall back to a plan that runs all specialists sequentially
    wasFallback = true;
    plan = {
      steps: specialists.map((s) => ({
        memberId: s.id,
        subPrompt: userPrompt,
        artifactType: inferArtifactType(s),
        usesPreviousSteps: [],
      })),
      synthesisInstruction: `Combine the team outputs into a clear, complete answer for: ${userPrompt}`,
    };
  }

  // Sanitise: drop any step referencing an unknown memberId
  const validIds = new Set(specialists.map((s) => s.id));
  plan.steps = plan.steps.filter((s) => validIds.has(s.memberId));

  // Guarantee at least one step
  if (plan.steps.length === 0) {
    plan.steps = specialists.slice(0, 1).map((s) => ({
      memberId: s.id,
      subPrompt: userPrompt,
      artifactType: inferArtifactType(s),
      usesPreviousSteps: [],
    }));
  }

  return {
    plan,
    modelId,
    promptTokens: result.usage?.inputTokens ?? 0,
    completionTokens: result.usage?.outputTokens ?? 0,
    wasFallback,
  };
}
