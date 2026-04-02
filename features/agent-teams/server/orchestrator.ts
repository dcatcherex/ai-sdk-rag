/**
 * Orchestration utilities for multi-agent team runs.
 *
 * Responsibilities:
 *  - Build focused sub-prompts for each specialist (user prompt + handoffInstructions)
 *  - Build context blocks from prior step summaries (not full outputs)
 *  - Synthesize a final answer by calling the orchestrator agent
 *  - Generate a short summary from a step's raw output (sentence-boundary truncation)
 */

import { generateText } from 'ai';
import { availableModels, chatModel } from '@/lib/ai';
import type { AgentTeamMemberWithAgent, ArtifactType, OrchestratorPlan } from '../types';

// ── Model resolution ──────────────────────────────────────────────────────────

/**
 * Resolve which model to use for an agent.
 * Falls back to the app default if the agent's model is unset or not in the
 * available list (handles model deprecations gracefully).
 */
export function resolveAgentModel(agentModelId: string | null | undefined): string {
  if (agentModelId && availableModels.some((m) => m.id === agentModelId)) {
    return agentModelId;
  }
  return chatModel;
}

// ── Context block ─────────────────────────────────────────────────────────────

export type StepContext = {
  agentName: string;
  displayRole: string | null;
  summary: string;
  artifactType: ArtifactType;
};

/**
 * Build a compact XML context block from prior step summaries.
 * Downstream specialists receive summaries only — full outputs are kept in the
 * DB and not re-injected to keep context windows clean.
 */
export function buildContextBlock(priorSteps: StepContext[]): string {
  if (priorSteps.length === 0) return '';

  const lines = priorSteps.map((s) => {
    const label = s.displayRole ?? s.agentName;
    return `<step role="${label}" type="${s.artifactType}">\n${s.summary}\n</step>`;
  });

  return `\n\n<team_context>\n${lines.join('\n')}\n</team_context>`;
}

// ── Sub-prompt builder ────────────────────────────────────────────────────────

/**
 * Compose the sub-prompt sent to a specialist.
 *
 * Structure:
 *   1. Optional team context block (prior step summaries)
 *   2. The user's original prompt
 *   3. Optional handoff instructions from the team member config
 */
export function buildSpecialistPrompt(params: {
  userPrompt: string;
  member: AgentTeamMemberWithAgent;
  priorSteps: StepContext[];
}): string {
  const { userPrompt, member, priorSteps } = params;
  const contextBlock = buildContextBlock(priorSteps);

  const handoffBlock = member.handoffInstructions
    ? `\n\n<handoff_instructions>\n${member.handoffInstructions}\n</handoff_instructions>`
    : '';

  return `${contextBlock}${handoffBlock}\n\n${userPrompt}`.trimStart();
}

// ── Summary generation ────────────────────────────────────────────────────────

/**
 * Produce a short summary (≤ 400 chars) of a specialist's output.
 *
 * Strategy: sentence-boundary truncation at ≤ 400 chars.
 * An LLM-based summary (higher quality) is planned for a future phase.
 */
export function generateStepSummary(output: string, maxChars = 400): string {
  if (!output) return '';
  if (output.length <= maxChars) return output.trim();

  // Truncate at the last sentence boundary within maxChars
  const slice = output.slice(0, maxChars);
  const lastSentence = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('.\n'),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );

  return lastSentence > 50
    ? slice.slice(0, lastSentence + 1).trim()
    : slice.trim() + '…';
}

// ── Artifact type detection ───────────────────────────────────────────────────

const TAG_MAP: [string[], ArtifactType][] = [
  [['research', 'data', 'analysis', 'insight', 'market', 'audience'], 'research_brief'],
  [['copy', 'ad', 'headline', 'caption', 'email', 'content', 'writing'], 'ad_copy'],
  [['analyz', 'metric', 'performance', 'report', 'kpi', 'stat'], 'analysis'],
  [['creative', 'visual', 'design', 'aesthetic', 'brand'], 'creative_direction'],
  [['strategy', 'plan', 'campaign', 'objective', 'goal'], 'strategy'],
  [['content', 'blog', 'post', 'article', 'script'], 'content'],
];

/**
 * Infer the artifact type from a team member's tags and display role.
 * Defaults to 'other' when no tag matches.
 */
export function inferArtifactType(member: AgentTeamMemberWithAgent): ArtifactType {
  const haystack = [
    ...member.tags,
    member.displayRole ?? '',
    member.agent.name,
  ]
    .join(' ')
    .toLowerCase();

  for (const [keywords, type] of TAG_MAP) {
    if (keywords.some((kw) => haystack.includes(kw))) return type;
  }
  return 'other';
}

// ── Synthesis ─────────────────────────────────────────────────────────────────

export type SynthesisStep = {
  agentName: string;
  displayRole: string | null;
  artifactType: ArtifactType;
  /** Full raw output — orchestrator gets everything for synthesis */
  output: string;
};

/**
 * Call the orchestrator agent to produce the final synthesised answer.
 *
 * The orchestrator receives all full step outputs (not just summaries) so it
 * can write a complete, high-quality final deliverable.
 */
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

  const modelId = resolveAgentModel(orchestratorMember.agent.modelId);

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
  const modelId = resolveAgentModel(orchestratorMember.agent.modelId);

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
