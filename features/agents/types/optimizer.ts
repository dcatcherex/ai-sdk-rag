import type { AuditFinding } from '@/features/agents/server/audit-service';

export type { AuditFinding };

// ── Allowed structural field names per target ─────────────────────────────────
// Kept as const sets so the apply service can validate AI output at runtime.

export const AGENT_STRUCTURAL_FIELDS = new Set([
  'enabledTools',
  'modelId',
] as const);

export const SKILL_ATTACHMENT_STRUCTURAL_FIELDS = new Set([
  'isEnabled',
  'activationModeOverride',
  'discoveryModeOverride',
  'triggerTypeOverride',
  'triggerOverride',
  'priority',
] as const);

export const TOOL_ATTACHMENT_STRUCTURAL_FIELDS = new Set([
  'requiresConfirmation',
  'isEnabled',
] as const);

export type AgentStructuralField = 'enabledTools' | 'modelId';
export type SkillAttachmentStructuralField =
  | 'isEnabled'
  | 'activationModeOverride'
  | 'discoveryModeOverride'
  | 'triggerTypeOverride'
  | 'triggerOverride'
  | 'priority';
export type ToolAttachmentStructuralField = 'requiresConfirmation' | 'isEnabled';

// ── Change types ──────────────────────────────────────────────────────────────

type ChangeBase = {
  id: string;
  title: string;
  rationale: string;
  section: string;
};

export type StructuralChange = ChangeBase & {
  type: 'structural';
  risk: 'low';
  currentValue: unknown;
  suggestedValue: unknown;
} & (
  | { target: 'agent';            field: AgentStructuralField }
  | { target: 'skill_attachment'; field: SkillAttachmentStructuralField; skillId: string }
  | { target: 'tool_attachment';  field: ToolAttachmentStructuralField;  userToolId: string }
);

export type SystemPromptChange = ChangeBase & {
  type: 'system_prompt';
  risk: 'high';
  before: string;
  after: string;
};

export type SkillForkChange = ChangeBase & {
  type: 'skill_fork';
  risk: 'medium';
  originalSkillId: string;
  originalSkillName: string;
  improvedPromptFragment: string;
  descriptionImproved?: string;
};

export type SkillNewChange = ChangeBase & {
  type: 'skill_new';
  risk: 'medium';
  skillName: string;          // slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, max 64 chars
  skillDescription: string;   // max 1024 chars
  promptFragment: string;
  activationMode: 'rule' | 'model';
  triggerType: 'slash' | 'keyword' | 'always';
  trigger: string;            // empty string when triggerType is 'always'
};

export type ToolOptimizeChange = ChangeBase & {
  type: 'tool_optimize';
  risk: 'medium';             // content change — individually confirmed
  userToolId: string;
  toolName: string;
  descriptionBefore: string;
  descriptionAfter: string;
  parameterChanges: Array<{
    paramName: string;
    descriptionBefore: string;
    descriptionAfter: string;
  }>;
};

export type ImprovementChange =
  | StructuralChange
  | SystemPromptChange
  | SkillForkChange
  | SkillNewChange
  | ToolOptimizeChange;

// ── Plan ──────────────────────────────────────────────────────────────────────

export type ImprovementPlan = {
  agentId: string;
  estimatedScoreAfter: number;
  reasoning: string;
  changes: ImprovementChange[];
};

// ── Apply result ──────────────────────────────────────────────────────────────

export type ApplyResult = {
  auditRunId: string;
  appliedChangeIds: string[];
  skippedChangeIds: string[];
  scoreAfter: number;
  statusAfter: string;
  errors: Array<{ changeId: string; error: string }>;
};
