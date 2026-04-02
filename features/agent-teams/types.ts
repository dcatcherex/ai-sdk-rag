import type { InferSelectModel } from 'drizzle-orm';
import type {
  agentTeam,
  agentTeamMember,
  teamRun,
  teamRunStep,
  AgentTeamConfig,
} from '@/db/schema';
import type { Agent } from '@/features/agents/types';

// ── Re-export DB config type ──────────────────────────────────────────────────
export type { AgentTeamConfig };

// ── Drizzle-inferred row types ────────────────────────────────────────────────
export type AgentTeamRow = InferSelectModel<typeof agentTeam>;
export type AgentTeamMemberRow = InferSelectModel<typeof agentTeamMember>;
export type TeamRunRow = InferSelectModel<typeof teamRun>;
export type TeamRunStepRow = InferSelectModel<typeof teamRunStep>;

// ── Routing strategy ──────────────────────────────────────────────────────────
export type RoutingStrategy = 'sequential' | 'planner_generated';

// ── Member role ───────────────────────────────────────────────────────────────
export type TeamMemberRole = 'orchestrator' | 'specialist';

// ── Run status ────────────────────────────────────────────────────────────────
export type TeamRunStatus = 'running' | 'completed' | 'failed';

// ── Step status ───────────────────────────────────────────────────────────────
export type TeamRunStepStatus = 'running' | 'completed' | 'failed';

// ── Artifact type ─────────────────────────────────────────────────────────────
export type ArtifactType =
  | 'research_brief'
  | 'ad_copy'
  | 'analysis'
  | 'creative_direction'
  | 'strategy'
  | 'content'
  | 'other';

// ── Enriched types (with joined data) ────────────────────────────────────────

export type AgentTeamMemberWithAgent = AgentTeamMemberRow & {
  agent: Agent;
};

export type AgentTeamWithMembers = AgentTeamRow & {
  members: AgentTeamMemberWithAgent[];
};

export type TeamRunWithSteps = TeamRunRow & {
  steps: TeamRunStepRow[];
};

// ── Planner structured output (strict JSON from orchestrator) ─────────────────

export type PlannerStep = {
  /** agentTeamMember.id of the specialist to call */
  memberId: string;
  /** Focused sub-prompt to send to this specialist */
  subPrompt: string;
  /** Expected artifact type — helps downstream context injection */
  artifactType: ArtifactType;
  /** IDs of previous step memberId values whose output this step needs */
  usesPreviousSteps: string[];
  /** Orchestrator's reasoning for this routing decision (for UI display) */
  reasoning?: string;
};

export type OrchestratorPlan = {
  steps: PlannerStep[];
  /** Instruction to the orchestrator for the final synthesis step */
  synthesisInstruction: string;
};

// ── Real-time streaming update (sent as data parts in team chat) ──────────────

export type TeamRunStatusUpdate =
  | {
      type: 'step_start';
      runId: string;
      stepIndex: number;
      memberId: string;
      agentId: string;
      agentName: string;
      displayRole: string | null;
    }
  | {
      type: 'step_complete';
      runId: string;
      stepIndex: number;
      memberId: string;
      agentId: string;
      agentName: string;
      displayRole: string | null;
      summary: string;
      artifactType: ArtifactType;
    }
  | {
      type: 'run_complete';
      runId: string;
    }
  | {
      type: 'run_error';
      runId: string;
      error: string;
    };

// ── Team templates ────────────────────────────────────────────────────────────

export type TeamMemberSlot = {
  displayRole: string;
  role: TeamMemberRole;
  tags: string[];
  position: number;
  /** Description of what kind of agent should fill this slot */
  slotHint: string;
};

export type TeamTemplate = {
  id: string;
  name: string;
  description: string;
  routingStrategy: RoutingStrategy;
  config: AgentTeamConfig;
  memberSlots: TeamMemberSlot[];
};

// ── Plan preview (Phase 3) ────────────────────────────────────────────────────

export type PlanPreviewStep = {
  memberId: string;
  memberName: string;
  displayRole: string | null;
  subPrompt: string;
  artifactType: ArtifactType;
  reasoning?: string;
};

export type PlanPreviewResponse = {
  steps: PlanPreviewStep[];
  synthesisInstruction: string;
  fallback: boolean;
};

// ── API input types ───────────────────────────────────────────────────────────

export type CreateAgentTeamInput = {
  name: string;
  description?: string;
  routingStrategy?: RoutingStrategy;
  config?: AgentTeamConfig;
  brandId?: string | null;
  isPublic?: boolean;
};

export type UpdateAgentTeamInput = Partial<CreateAgentTeamInput>;

export type AddTeamMemberInput = {
  agentId: string;
  role?: TeamMemberRole;
  displayRole?: string;
  position?: number;
  tags?: string[];
  handoffInstructions?: string;
};

export type UpdateTeamMemberInput = Partial<Omit<AddTeamMemberInput, 'agentId'>>;
