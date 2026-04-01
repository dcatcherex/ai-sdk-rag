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
import type { AgentTeamMemberWithAgent, ArtifactType } from '../types';

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
export async function synthesizeWithOrchestrator(params: {
  orchestratorMember: AgentTeamMemberWithAgent;
  userPrompt: string;
  steps: SynthesisStep[];
  outputFormat?: 'markdown' | 'json';
}): Promise<{ text: string; modelId: string; promptTokens: number; completionTokens: number }> {
  const { orchestratorMember, userPrompt, steps, outputFormat } = params;

  const modelId = resolveAgentModel(orchestratorMember.agent.modelId);

  const researchBlock = steps
    .map((s) => {
      const label = s.displayRole ?? s.agentName;
      return `<specialist role="${label}" type="${s.artifactType}">\n${s.output}\n</specialist>`;
    })
    .join('\n\n');

  const formatHint =
    outputFormat === 'json'
      ? '\n\nOutput must be valid JSON.'
      : '\n\nFormat your response in clear Markdown.';

  const synthesisPrompt = `You are synthesizing the work of your specialist team into a final deliverable.

Original request from the user:
${userPrompt}

Work produced by your team:
${researchBlock}

Now write the final, polished deliverable that directly addresses the user's request. Combine the team's work coherently — do not just concatenate their outputs.${formatHint}`;

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
