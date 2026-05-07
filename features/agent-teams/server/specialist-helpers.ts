/**
 * Shared types and pure prompt-building helpers for agent-team runs.
 * No DB, no LLM — safe to import from any layer.
 */

import type {
  AgentTeamMemberWithAgent,
  AgentTeamWithMembers,
  ArtifactType,
  OrchestratorPlan,
  TeamRunRow,
  TeamRunStatusUpdate,
} from '../types';

// ── Shared types ──────────────────────────────────────────────────────────────

export type StepContext = {
  agentName: string;
  displayRole: string | null;
  summary: string;
  artifactType: ArtifactType;
};

export type SynthesisStep = {
  agentName: string;
  displayRole: string | null;
  artifactType: ArtifactType;
  /** Full raw output — orchestrator gets everything for synthesis. */
  output: string;
};

/** Resolved execution step — same shape regardless of routing strategy. */
export type ResolvedStep = {
  member: AgentTeamMemberWithAgent;
  /** null = build dynamically from context (sequential). Non-null = from plan. */
  subPrompt: string | null;
  /** null = infer from member tags (sequential). Non-null = from plan. */
  plannedArtifactType: ArtifactType | null;
};

/** Execution context created by the dispatcher and consumed by path functions. */
export type TeamRunContext = {
  run: TeamRunRow;
  orchestrator: AgentTeamMemberWithAgent;
  specialists: AgentTeamMemberWithAgent[];
  team: AgentTeamWithMembers;
  userId: string;
  userPrompt: string;
  onUpdate: (update: TeamRunStatusUpdate) => void;
  approvedPlan?: OrchestratorPlan;
  maxSteps: number;
};

export type ExecuteTeamRunResult = {
  run: TeamRunRow;
  finalOutput: string;
};

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

// ── Pure prompt-building helpers ──────────────────────────────────────────────

/**
 * Build a compact XML context block from prior step summaries.
 * Specialists receive summaries only — full outputs stay in DB to keep context windows clean.
 */
export function buildContextBlock(priorSteps: StepContext[]): string {
  if (priorSteps.length === 0) return '';

  const lines = priorSteps.map((s) => {
    const label = s.displayRole ?? s.agentName;
    return `<step role="${label}" type="${s.artifactType}">\n${s.summary}\n</step>`;
  });

  return `\n\n<team_context>\n${lines.join('\n')}\n</team_context>`;
}

/**
 * Compose the sub-prompt sent to a specialist.
 *
 * Structure:
 *   1. Optional team context block (prior step summaries)
 *   2. Optional handoff instructions from the member config
 *   3. The user's original prompt
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

/**
 * Produce a short summary (≤ 400 chars) of a specialist's output.
 * Uses sentence-boundary truncation.
 */
export function generateStepSummary(output: string, maxChars = 400): string {
  if (!output) return '';
  if (output.length <= maxChars) return output.trim();

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

/** Infer the artifact type from a team member's tags and display role. Defaults to 'other'. */
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
