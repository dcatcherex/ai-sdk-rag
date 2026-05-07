# Agent Optimizer — Implementation Guide

> **Audience:** AI coders and developers building the Agent Optimizer feature.
> **Status:** Ready to implement — all design decisions finalized.
> **Scope:** AI-powered agent self-improvement: system prompt rewrite, skill forking, new skill scaffolding, tool description optimization, structural fixes, audit score history.

---

## 1. What this feature does

Agents have many interconnected settings (system prompt, skills, tools, knowledge, MCP servers). Users and admins cannot easily detect misconfigurations or quality gaps. This feature adds an **AI optimizer** that:

1. **Audits** the agent using shared audit service functions (not the HTTP endpoints)
2. **Generates an ImprovementPlan** — a structured JSON list of concrete, apply-ready changes across all settings
3. **Applies changes** in two groups:
   - Low-risk structural fixes (triggers, tool IDs, `requiresConfirmation`) → apply-all with one click
   - Higher-risk content changes (prompt rewrite, skill fork, new skill, tool descriptions) → show diff, confirm individually
4. **Re-audits** after apply and persists the before/after score in `agentAuditRun`
5. **Shows history** so users can track improvement over time

Available to both **admin** (for managed template agents) and **regular users** (for their own agents).

---

## 2. Key design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Audit data source for optimizer | Shared service functions, not internal `fetch()` | Consistent rule: service layer calls service layer, never HTTP-to-self |
| Skill edits affect all users who share the skill | **Fork** — create a modified copy, attach to this agent only | No silent modification of shared skills |
| Forked skill ownership | Set to the **agent owner's userId** | Appears in their skills library; they can edit further |
| Forked skill slug | `${original.name}-v2` (falls back to `${original.name}-${nanoid(4)}` on collision) | `name` is a slug field with regex validation — no spaces or parens |
| Tool optimization UX | Individual diff view + confirm (medium risk) | Tool descriptions change how the LLM reasons — content change, not mechanical |
| New skill suggestion | AI writes full SKILL.md content when it detects a capability gap | Closes gaps automatically |
| Structural changes UX | Apply-all in one click (low risk) | Mechanical fixes: field values come from an explicit allowlist, not free AI text |
| Structural field safety | Explicit allowlist per target — agent fields, skill attachment fields, tool attachment fields | AI-provided `field` values must never be used as dynamic DB column names |
| Ownership pre-check on apply | Verify `currentValue` still matches DB before writing | Prevents stale-plan overwrites if user manually edited between generate and apply |
| Score persistence | `agentAuditRun` table, `scoreBefore` + `scoreAfter` | Enables trend tracking |
| Generate response | Returns `{ auditRunId, plan, scoreBefore, statusBefore }` | UI needs `scoreBefore` to render the score bar — it must come from the API |
| Schema mismatch handling | Normalize common near-miss fields, then retry `generateObject` once with validation feedback | LLMs can drift into generic patch JSON or wrong fixed enums unless the service repairs predictable mistakes |
| History URL | Separate route `optimize/history/route.ts` | Cannot share GET + POST on `/optimize` without method confusion |
| DB schema JSONB columns | Plain `jsonb().notNull()` — no `.$type<FeatureType>()` | DB schema must not import from the feature layer; casts happen in the service |
| AI model | `getModelSlot('optimizerModel')` via `generateObject` | Gives the optimizer an independent capability/cost dial without changing every background job |
| `testMessage` pre-fill | `agent.starterTasks[0].prompt` if present | Near-zero friction for users |

---

## 3. Files to create

```
features/agents/server/audit-service.ts               ← NEW shared audit logic (extracted from route)
features/agents/types/optimizer.ts                    ← NEW types
features/agents/server/optimizer.ts                   ← NEW plan generation service
features/agents/server/optimizer-apply.ts             ← NEW plan apply service
features/agents/components/agent-optimizer-panel.tsx  ← NEW UI panel

app/api/admin/agents/[id]/optimize/route.ts           ← NEW admin generate endpoint
app/api/admin/agents/[id]/optimize/apply/route.ts     ← NEW admin apply endpoint
app/api/admin/agents/[id]/optimize/history/route.ts   ← NEW admin history endpoint
app/api/agents/[id]/optimize/route.ts                 ← NEW user generate endpoint
app/api/agents/[id]/optimize/apply/route.ts           ← NEW user apply endpoint
app/api/agents/[id]/optimize/history/route.ts         ← NEW user history endpoint

db/migrations/XXXX_agent_audit_runs.sql               ← NEW migration
```

Files to **edit**:
```
db/schema/agents.ts          ← add agentAuditRun table
db/schema.ts                 ← export agentAuditRun (this is the barrel file, not db/schema/index.ts)
app/api/admin/agents/[id]/audit-report/route.ts  ← refactor to call audit-service.ts
app/admin/agents/page.tsx    ← add Optimize tab to AdminAgentEditor
app/(main)/agents/[id]/page.tsx  (or agent editor page) ← add Optimize tab for users
```

---

## 4. Shared audit service — `features/agents/server/audit-service.ts`

**Extract the audit logic** from `app/api/admin/agents/[id]/audit-report/route.ts` into this shared service. Both the existing admin audit-report route and the new optimizer routes call this service directly. No HTTP-to-self anywhere.

```typescript
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  agent,
  agentSkill,
  agentSkillAttachment,
  agentUserToolAttachment,
  document,
  userTool,
} from '@/db/schema';
import { TOOL_MANIFESTS } from '@/features/tools/registry/client';
import { getSkillsByIds, resolveSkillRuntimeContext } from '@/features/skills/service';

// These types mirror what audit-report/route.ts already defines — consolidate here
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AuditFinding = {
  code: string;
  severity: Severity;
  section: string;
  message: string;
  recommendation: string;
  evidence?: Record<string, unknown>;
};

export type AuditRecommendedChange = {
  section: string;
  action: 'set' | 'add' | 'remove' | 'review';
  field?: string;
  value?: unknown;
  rationale: string;
};

export type AuditResult = {
  agentId: string;
  generatedAt: string;
  summary: {
    readinessScore: number;
    status: 'ready' | 'improve' | 'needs_attention';
    totalFindings: number;
    severityCounts: Record<Severity, number>;
    testMessageUsed: string;
  };
  context: Record<string, unknown>;
  findings: AuditFinding[];
  recommendedChanges: AuditRecommendedChange[];
  promptPatch: { shouldApply: boolean; title: string; reason: string; block: string };
  preview: { attachedSkillNames: string[]; activatedSkillNames: string[]; activeTools: { id: string; title: string }[] };
};

export async function runAgentAudit(
  agentId: string,
  testMessage: string,
): Promise<AuditResult | null> {
  // Move the full body of audit-report/route.ts GET handler here.
  // Return null if agent not found.
  // The route handler becomes a thin wrapper:
  //   const result = await runAgentAudit(id, testMessage);
  //   if (!result) return Response.json({ error: 'Not found' }, { status: 404 });
  //   return Response.json(result);
  throw new Error('Not implemented — extract from audit-report/route.ts');
}
```

Once extracted, the existing `audit-report` route becomes:

```typescript
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const testMessage = new URL(req.url).searchParams.get('testMessage') ?? '';
  const result = await runAgentAudit(id, testMessage);
  if (!result) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(result);
}
```

---

## 5. Database — `agentAuditRun` table

### 5.1 Add to `db/schema/agents.ts`

Do **not** import feature-layer types into the schema file. Use plain `jsonb()` columns; the service layer casts them.

```typescript
import { sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

export const agentAuditRun = pgTable('agent_audit_run', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agentId: text('agent_id')
    .notNull()
    .references(() => agent.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  scoreBefore: integer('score_before').notNull(),
  scoreAfter: integer('score_after'),
  statusBefore: text('status_before').notNull(),   // 'ready' | 'improve' | 'needs_attention'
  statusAfter: text('status_after'),
  testMessage: text('test_message').notNull().default(''),
  findings: jsonb('findings').notNull(),           // AuditFinding[] — cast in service layer
  plan: jsonb('plan').notNull(),                   // ImprovementChange[] — cast in service layer
  appliedChangeIds: text('applied_change_ids').array().notNull().default(sql`'{}'`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 5.2 Export from barrel — `db/schema.ts`

```typescript
// Add to the existing export list in db/schema.ts:
export { agentAuditRun } from './schema/agents';
```

### 5.3 Migration SQL

```sql
CREATE TABLE IF NOT EXISTS "agent_audit_run" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agent"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "score_before" integer NOT NULL,
  "score_after" integer,
  "status_before" text NOT NULL,
  "status_after" text,
  "test_message" text NOT NULL DEFAULT '',
  "findings" jsonb NOT NULL,
  "plan" jsonb NOT NULL,
  "applied_change_ids" text[] NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_audit_run_agent_id_idx"
  ON "agent_audit_run" ("agent_id");

CREATE INDEX IF NOT EXISTS "agent_audit_run_user_id_idx"
  ON "agent_audit_run" ("user_id");
```

Run after creating:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

---

## 6. Types — `features/agents/types/optimizer.ts`

```typescript
import type { AuditFinding } from '@/features/agents/server/audit-service';

export type { AuditFinding };

// ── Structural change — explicit field names, never a free AI string ──────────

export type AgentStructuralField = 'enabledTools' | 'modelId';

export type SkillAttachmentStructuralField =
  | 'isEnabled'
  | 'activationModeOverride'
  | 'triggerTypeOverride'
  | 'triggerOverride'
  | 'priority';

export type ToolAttachmentStructuralField = 'requiresConfirmation' | 'isEnabled';

export type StructuralChange = {
  type: 'structural';
  risk: 'low';
  id: string;
  title: string;
  rationale: string;
  section: string;
  currentValue: unknown;
  suggestedValue: unknown;
} & (
  | { target: 'agent';           field: AgentStructuralField }
  | { target: 'skill_attachment'; field: SkillAttachmentStructuralField; skillId: string }
  | { target: 'tool_attachment';  field: ToolAttachmentStructuralField;  userToolId: string }
);

// ── Content change types ─────────────────────────────────────────────────────

export type SystemPromptChange = {
  type: 'system_prompt';
  risk: 'high';
  id: string;
  title: string;
  rationale: string;
  before: string;
  after: string;
};

export type SkillForkChange = {
  type: 'skill_fork';
  risk: 'medium';
  id: string;
  title: string;
  rationale: string;
  originalSkillId: string;
  originalSkillName: string;
  improvedPromptFragment: string;
  descriptionImproved?: string;
};

export type SkillNewChange = {
  type: 'skill_new';
  risk: 'medium';
  id: string;
  title: string;
  rationale: string;
  skillName: string;           // slug: lowercase-hyphen, max 64 chars, regex /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  skillDescription: string;    // max 1024 chars
  promptFragment: string;
  activationMode: 'rule' | 'model';
  triggerType: 'slash' | 'keyword' | 'always';
  trigger: string;             // empty string when triggerType is 'always'
};

export type ToolOptimizeChange = {
  type: 'tool_optimize';
  risk: 'medium';              // content change — individually confirmed
  id: string;
  title: string;
  rationale: string;
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

// ── Plan ─────────────────────────────────────────────────────────────────────

export type ImprovementPlan = {
  agentId: string;
  estimatedScoreAfter: number;
  reasoning: string;
  changes: ImprovementChange[];
};

// ── Apply result ─────────────────────────────────────────────────────────────

export type ApplyResult = {
  auditRunId: string;
  appliedChangeIds: string[];
  skippedChangeIds: string[];
  scoreAfter: number;
  statusAfter: string;
  errors: Array<{ changeId: string; error: string }>;
};
```

**Key difference from the naive approach:** `StructuralChange` uses a discriminated union on `target` with literal field-name types. The apply service switches on `target` and uses explicit `db.update(...).set({ [allowedField]: value })` where `allowedField` is one of the typed literals — not a free AI string.

---

## 7. Zod schema for `generateObject` — `features/agents/server/optimizer-schema.ts`

Extract to a separate file to keep `optimizer.ts` readable.

```typescript
import { z } from 'zod';

const structuralChangeSchema = z.object({
  type: z.literal('structural'),
  risk: z.literal('low'),
  id: z.string().min(1).max(80),
  title: z.string().max(120),
  rationale: z.string().max(300),
  section: z.string(),
  currentValue: z.unknown(),
  suggestedValue: z.unknown(),
  target: z.enum(['agent', 'skill_attachment', 'tool_attachment']),
  // Validated narrowly in the apply service — Zod only checks shape, not allowlist
  field: z.string().min(1).max(60),
  skillId: z.string().optional(),
  userToolId: z.string().optional(),
});

const systemPromptChangeSchema = z.object({
  type: z.literal('system_prompt'),
  risk: z.literal('high'),
  id: z.string().min(1).max(80),
  title: z.string().max(120),
  rationale: z.string().max(300),
  before: z.string(),
  after: z.string().min(1),
});

const skillForkChangeSchema = z.object({
  type: z.literal('skill_fork'),
  risk: z.literal('medium'),
  id: z.string().min(1).max(80),
  title: z.string().max(120),
  rationale: z.string().max(300),
  originalSkillId: z.string().min(1),
  originalSkillName: z.string(),
  improvedPromptFragment: z.string().min(1),
  descriptionImproved: z.string().max(1024).optional(),
});

const skillNewChangeSchema = z.object({
  type: z.literal('skill_new'),
  risk: z.literal('medium'),
  id: z.string().min(1).max(80),
  title: z.string().max(120),
  rationale: z.string().max(300),
  skillName: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
  skillDescription: z.string().max(1024),
  promptFragment: z.string().min(1),
  activationMode: z.enum(['rule', 'model']),
  triggerType: z.enum(['slash', 'keyword', 'always']),
  trigger: z.string().max(100),
});

const toolOptimizeChangeSchema = z.object({
  type: z.literal('tool_optimize'),
  risk: z.literal('medium'),
  id: z.string().min(1).max(80),
  title: z.string().max(120),
  rationale: z.string().max(300),
  userToolId: z.string().min(1),
  toolName: z.string(),
  descriptionBefore: z.string(),
  descriptionAfter: z.string().min(1),
  parameterChanges: z.array(z.object({
    paramName: z.string().min(1),
    descriptionBefore: z.string(),
    descriptionAfter: z.string().min(1),
  })),
});

export const improvementPlanSchema = z.object({
  agentId: z.string(),
  estimatedScoreAfter: z.number().int().min(0).max(100),
  reasoning: z.string().max(500),
  changes: z.array(
    z.discriminatedUnion('type', [
      structuralChangeSchema,
      systemPromptChangeSchema,
      skillForkChangeSchema,
      skillNewChangeSchema,
      toolOptimizeChangeSchema,
    ]),
  ).max(20),
});
```

---

## 8. Optimizer service — `features/agents/server/optimizer.ts`

```typescript
import { generateObject, NoObjectGeneratedError } from 'ai';
import { nanoid } from 'nanoid';
import { getModelSlot } from '@/lib/ai-config';
import { runAgentAudit, type AuditResult } from './audit-service';
import { improvementPlanSchema } from './optimizer-schema';
import type { ImprovementPlan } from '@/features/agents/types/optimizer';

const OPTIMIZER_SYSTEM = `You are an expert AI agent configuration optimizer for Vaja AI platform.

Your job: analyze an agent's full configuration snapshot and audit findings, then produce a concrete, apply-ready improvement plan.

## Rules

1. Every change must have a unique id — use a short descriptive slug (e.g. "fix-trigger-sales-brief", "rewrite-prompt").
2. Only suggest changes you have evidence for from the audit findings or snapshot.
3. For structural changes (target: agent/skill_attachment/tool_attachment):
   - field must be one of the allowed values for that target (see below)
   - agent fields: enabledTools, modelId
   - skill_attachment fields: isEnabled, activationModeOverride, triggerTypeOverride, triggerOverride, priority
   - tool_attachment fields: requiresConfirmation, isEnabled
   - Provide exact suggestedValue — never vague text like "add search tools"
4. For system_prompt: preserve the agent's role and tone. Improve clarity, add decision policy, add constraints. Do NOT change the agent's core purpose.
5. For skill_fork: write production-ready promptFragment in SKILL.md style. Start with a role statement, then numbered rules. No filler.
6. For skill_new: only when there is a clear capability gap that no existing skill covers. skillName must be a lowercase-hyphen slug, max 64 chars.
7. For tool_optimize: rewrite descriptions to be action-oriented ("Searches the web for current prices") not passive ("A tool that searches"). Param descriptions should explain expected format and when to pass the value.
8. estimatedScoreAfter: be realistic. Re-run the scoring math: 100 minus penalties for findings you don't fix.
9. Maximum 20 changes per plan.
10. reasoning: 1-2 sentences on the overall strategy.

## Language
Agent prompts may be Thai or English. Match the language of the existing systemPrompt.`;

const PLAN_OUTPUT_FORMAT = `Return JSON that matches the schema exactly.

Top-level object:
- agentId: string
- estimatedScoreAfter: integer 0-100
- reasoning: string
- changes: array of change objects

Every item in changes must include:
- id
- title
- rationale
- section
- type
- risk

Choose exactly one of these five change shapes:

1. structural → use target + field + currentValue + suggestedValue
2. system_prompt → use before + after
3. skill_fork → use originalSkillId + originalSkillName + improvedPromptFragment
4. skill_new → use skillName + skillDescription + promptFragment + activationMode + triggerType + trigger
5. tool_optimize → use userToolId + toolName + descriptionBefore + descriptionAfter + parameterChanges

Important:
- Do not invent fields such as action or field:"systemPrompt" for a prompt rewrite.
- If you are rewriting the system prompt, use type "system_prompt" with before and after.
- Risk is fixed by type: structural=low, system_prompt=high, skill_fork=medium, skill_new=medium, tool_optimize=medium.
- Use only one change shape per item; do not mix schemas.
- Return valid JSON only.`;

function buildOptimizerPrompt(
  agentId: string,
  audit: AuditResult,
  snapshot: Record<string, unknown>,
  retryFeedback?: string,
): string {
  const sections = [
    '## Agent ID',
    agentId,
    '',
    '## Current Readiness Score',
    `${audit.summary.readinessScore} / 100  (status: ${audit.summary.status})`,
    '',
    '## Audit Findings',
    JSON.stringify(audit.findings, null, 2),
    '',
    '## Rules Engine Recommended Changes',
    JSON.stringify(audit.recommendedChanges, null, 2),
    '',
    '## Full Configuration Snapshot',
    JSON.stringify(snapshot, null, 2),
  ];

  if (retryFeedback) {
    sections.push('', '## Retry Feedback', retryFeedback);
  }

  sections.push('', 'Produce a comprehensive improvement plan that fixes all findings and improves overall quality.');

  return sections.join('\n');
}

function buildRetryFeedback(error: NoObjectGeneratedError): string {
  const details = [
    'Your previous response did not match the required schema.',
    'Fix the JSON so every change uses one of the five allowed shapes exactly.',
    `Validation error: ${error.message}`,
  ];

  if (error.text) {
    details.push('Previous invalid JSON:', error.text);
  }

  return details.join('\n\n');
}

function normalizePlanCandidate(raw: unknown, agentId: string): unknown {
  // Repair common near-miss outputs before throwing:
  // - tool_optimize risk "low" -> "medium"
  // - skill_fork / skill_new risk -> "medium"
  // - system_prompt risk -> "high"
  // - skill_attachment field "trigger" -> "triggerOverride"
  // - fill missing agentId from the route param
  return raw;
}

export async function generateImprovementPlan(
  agentId: string,
  audit: AuditResult,
  snapshot: Record<string, unknown>,
): Promise<ImprovementPlan> {
  const model = await getModelSlot('optimizerModel');
  const system = `${OPTIMIZER_SYSTEM}\n\n${PLAN_OUTPUT_FORMAT}`;
  const prompt = buildOptimizerPrompt(agentId, audit, snapshot);

  let object: ImprovementPlan;

  try {
    const result = await generateObject({
      model,
      schema: improvementPlanSchema,
      system,
      prompt,
    });
    object = result.object as ImprovementPlan;
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error)) {
      throw error;
    }

    const repairedFirstPass = recoverPlanFromError(error, agentId);
    if (repairedFirstPass) {
      object = repairedFirstPass;
    } else {
      try {
        const retryResult = await generateObject({
          model,
          schema: improvementPlanSchema,
          system,
          prompt: buildOptimizerPrompt(agentId, audit, snapshot, buildRetryFeedback(error)),
        });
        object = retryResult.object as ImprovementPlan;
      } catch (retryError) {
        if (!NoObjectGeneratedError.isInstance(retryError)) {
          throw retryError;
        }

        const repairedRetryPass = recoverPlanFromError(retryError, agentId);
        if (!repairedRetryPass) {
          throw retryError;
        }

        object = repairedRetryPass;
      }
    }
  }

  // Deduplicate IDs if AI produced collisions
  const seenIds = new Set<string>();
  const changes = object.changes.map((change) => {
    if (seenIds.has(change.id)) {
      const deduped = { ...change, id: `${change.id}-${nanoid(4)}` };
      seenIds.add(deduped.id);
      return deduped;
    }
    seenIds.add(change.id);
    return change;
  });

  return { ...object, agentId, changes } as ImprovementPlan;
}
```

The recovery flow is intentionally narrow:
- First, repair predictable near-miss outputs from the invalid object itself.
- Then, retry once only when the model still did not produce schema-valid JSON.

This covers common format drift cases such as:
- returning `{ action: "update", field: "systemPrompt" }` instead of a valid `system_prompt` change
- returning `risk: "low"` for `tool_optimize` even though that type always requires `risk: "medium"`
- returning `field: "trigger"` for a skill attachment when the persisted override field is `triggerOverride`

The optimizer should use its own model slot instead of `backgroundModel`. That lets admins upgrade the optimizer to a more capable model without also increasing the cost and latency of other background flows such as summaries, memory extraction, skill discovery, or content utilities.

---

## 9. Apply service — `features/agents/server/optimizer-apply.ts`

All DB writes go through existing service functions or direct Drizzle calls with **explicit field names only**. AI-provided `field` strings are validated against allowlists before any DB call.

### 9.1 Field allowlists

```typescript
const AGENT_STRUCTURAL_FIELDS = new Set(['enabledTools', 'modelId'] as const);

const SKILL_ATTACHMENT_FIELDS = new Set([
  'isEnabled',
  'activationModeOverride',
  'triggerTypeOverride',
  'triggerOverride',
  'priority',
] as const);

const TOOL_ATTACHMENT_FIELDS = new Set([
  'requiresConfirmation',
  'isEnabled',
] as const);
```

### 9.2 Structural change batching with pre-check

```typescript
async function applyStructuralChanges(
  agentId: string,
  isAdmin: boolean,
  changes: StructuralChange[],
): Promise<void> {
  if (changes.length === 0) return;

  for (const change of changes) {
    if (change.target === 'agent') {
      if (!AGENT_STRUCTURAL_FIELDS.has(change.field as never)) {
        throw new Error(`Disallowed agent field: ${change.field}`);
      }
      // Pre-check: verify currentValue still matches
      const [row] = await db.select().from(agent).where(eq(agent.id, agentId)).limit(1);
      if (!row) throw new Error('Agent not found');
      const actual = row[change.field as keyof typeof row];
      if (JSON.stringify(actual) !== JSON.stringify(change.currentValue)) {
        throw new Error(
          `Stale plan: ${change.field} changed since plan was generated. Re-analyze before applying.`,
        );
      }
      if (isAdmin) {
        await updateAdminAgentTemplate(agentId, { [change.field]: change.suggestedValue });
      } else {
        await db.update(agent).set({ [change.field]: change.suggestedValue }).where(eq(agent.id, agentId));
      }
    } else if (change.target === 'skill_attachment') {
      if (!SKILL_ATTACHMENT_FIELDS.has(change.field as never)) {
        throw new Error(`Disallowed skill attachment field: ${change.field}`);
      }
      await db
        .update(agentSkillAttachment)
        .set({ [change.field]: change.suggestedValue })
        .where(
          and(
            eq(agentSkillAttachment.agentId, agentId),
            eq(agentSkillAttachment.skillId, change.skillId),
          ),
        );
    } else if (change.target === 'tool_attachment') {
      if (!TOOL_ATTACHMENT_FIELDS.has(change.field as never)) {
        throw new Error(`Disallowed tool attachment field: ${change.field}`);
      }
      await db
        .update(agentUserToolAttachment)
        .set({ [change.field]: change.suggestedValue })
        .where(
          and(
            eq(agentUserToolAttachment.agentId, agentId),
            eq(agentUserToolAttachment.userToolId, change.userToolId),
          ),
        );
    }
  }
}
```

### 9.3 Skill fork

The forked skill `name` is a slug. The description can carry human-readable context about its origin.

```typescript
async function applySkillFork(
  agentId: string,
  userId: string,
  change: SkillForkChange,
): Promise<void> {
  const original = await getSkillById(userId, change.originalSkillId);
  if (!original) throw new Error(`Original skill ${change.originalSkillId} not found`);

  // Slug: try -v2, fall back to -v2-{nanoid} on collision
  let forkSlug = `${original.name}-v2`;
  let forked;
  try {
    forked = await createSkill(userId, {
      name: forkSlug,
      description: change.descriptionImproved ?? `${original.description} (optimized)`,
      promptFragment: change.improvedPromptFragment,
      activationMode: original.activationMode,
      triggerType: original.triggerType,
      trigger: original.trigger,
      enabledTools: original.enabledTools,
      skillKind: 'inline',
    });
  } catch {
    // Retry with nanoid suffix on slug collision
    forkSlug = `${original.name}-v2-${nanoid(4)}`;
    forked = await createSkill(userId, {
      name: forkSlug,
      description: change.descriptionImproved ?? `${original.description} (optimized)`,
      promptFragment: change.improvedPromptFragment,
      activationMode: original.activationMode,
      triggerType: original.triggerType,
      trigger: original.trigger,
      enabledTools: original.enabledTools,
      skillKind: 'inline',
    });
  }

  // Swap the attachment to point to the fork
  await db
    .update(agentSkillAttachment)
    .set({ skillId: forked.id })
    .where(
      and(
        eq(agentSkillAttachment.agentId, agentId),
        eq(agentSkillAttachment.skillId, change.originalSkillId),
      ),
    );
}
```

### 9.4 New skill creation

```typescript
async function applySkillNew(
  agentId: string,
  userId: string,
  change: SkillNewChange,
): Promise<void> {
  const newSkill = await createSkill(userId, {
    name: change.skillName,
    description: change.skillDescription,
    promptFragment: change.promptFragment,
    activationMode: change.activationMode,
    triggerType: change.triggerType,
    trigger: change.trigger || null,
    skillKind: 'inline',
  });

  await db.insert(agentSkillAttachment).values({
    id: nanoid(),
    agentId,
    skillId: newSkill.id,
    isEnabled: true,
    priority: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
```

### 9.5 Tool description optimization

```typescript
async function applyToolOptimize(
  userId: string,
  change: ToolOptimizeChange,
): Promise<void> {
  const result = await getUserToolById(change.userToolId, userId);
  if (!result) throw new Error(`Tool ${change.userToolId} not found`);

  const currentParams = (result.tool.parameters ?? []) as Array<{
    name: string;
    description?: string;
    [key: string]: unknown;
  }>;

  const updatedParams = currentParams.map((param) => {
    const patch = change.parameterChanges.find((p) => p.paramName === param.name);
    return patch ? { ...param, description: patch.descriptionAfter } : param;
  });

  await updateUserTool(userId, change.userToolId, {
    description: change.descriptionAfter,
    parameters: updatedParams,
  });
}
```

### 9.6 Main apply function

```typescript
export async function applyImprovementPlan(
  auditRunId: string,
  agentId: string,
  userId: string,
  isAdmin: boolean,
  plan: ImprovementPlan,
  changeIdsToApply: string[],
): Promise<ApplyResult> {
  const changesToApply = plan.changes.filter((c) => changeIdsToApply.includes(c.id));
  const appliedIds: string[] = [];
  const errors: Array<{ changeId: string; error: string }> = [];

  // Batch all structural changes
  const structuralChanges = changesToApply.filter(
    (c): c is StructuralChange => c.type === 'structural',
  );
  try {
    await applyStructuralChanges(agentId, isAdmin, structuralChanges);
    appliedIds.push(...structuralChanges.map((c) => c.id));
  } catch (err) {
    for (const c of structuralChanges) {
      errors.push({ changeId: c.id, error: String(err) });
    }
  }

  // Apply each content change individually
  for (const change of changesToApply) {
    if (change.type === 'structural') continue;
    try {
      switch (change.type) {
        case 'system_prompt':
          if (isAdmin) {
            await updateAdminAgentTemplate(agentId, { systemPrompt: change.after });
          } else {
            await db.update(agent).set({ systemPrompt: change.after }).where(eq(agent.id, agentId));
          }
          break;
        case 'skill_fork':
          await applySkillFork(agentId, userId, change);
          break;
        case 'skill_new':
          await applySkillNew(agentId, userId, change);
          break;
        case 'tool_optimize':
          await applyToolOptimize(userId, change);
          break;
      }
      appliedIds.push(change.id);
    } catch (err) {
      errors.push({ changeId: change.id, error: String(err) });
    }
  }

  // Re-run audit for updated score
  const reaudit = await runAgentAudit(agentId, '');
  const scoreAfter = reaudit?.summary.readinessScore ?? 0;
  const statusAfter = reaudit?.summary.status ?? 'unknown';

  await db
    .update(agentAuditRun)
    .set({ appliedChangeIds: appliedIds, scoreAfter, statusAfter })
    .where(eq(agentAuditRun.id, auditRunId));

  return {
    auditRunId,
    appliedChangeIds: appliedIds,
    skippedChangeIds: changeIdsToApply.filter((id) => !appliedIds.includes(id)),
    scoreAfter,
    statusAfter,
    errors,
  };
}
```

---

## 10. API routes

### 10.1 Admin generate — `app/api/admin/agents/[id]/optimize/route.ts`

```typescript
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { agent, agentAuditRun } from '@/db/schema';
import { runAgentAudit } from '@/features/agents/server/audit-service';
import { generateImprovementPlan } from '@/features/agents/server/optimizer';

const bodySchema = z.object({
  testMessage: z.string().max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: 'Bad Request' }, { status: 400 });

  const { id } = await params;
  const testMessage = body.data.testMessage ?? '';

  // Fetch audit result and snapshot in parallel — all via service functions, no HTTP-to-self
  const [audit, snapshotRow] = await Promise.all([
    runAgentAudit(id, testMessage),
    db.select().from(agent).where(eq(agent.id, id)).limit(1),
  ]);

  if (!audit || snapshotRow.length === 0) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Short-circuit: already at 100
  if (audit.summary.readinessScore === 100) {
    return Response.json({
      auditRunId: null,
      plan: { agentId: id, estimatedScoreAfter: 100, reasoning: 'Agent is already fully optimized.', changes: [] },
      scoreBefore: 100,
      statusBefore: 'ready',
    });
  }

  const snapshot = snapshotRow[0] as Record<string, unknown>;
  const plan = await generateImprovementPlan(id, audit, snapshot);

  const [auditRun] = await db
    .insert(agentAuditRun)
    .values({
      id: nanoid(),
      agentId: id,
      userId: adminCheck.userId,
      scoreBefore: audit.summary.readinessScore,
      statusBefore: audit.summary.status,
      testMessage,
      findings: audit.findings,
      plan: plan.changes,
      appliedChangeIds: [],
    })
    .returning();

  return Response.json({
    auditRunId: auditRun.id,
    plan,
    scoreBefore: audit.summary.readinessScore,
    statusBefore: audit.summary.status,
  });
}
```

**Note:** `snapshot` here passes the raw agent DB row to `generateImprovementPlan`. For a richer snapshot (including skill attachments, tool attachments, etc.) consider calling `runAgentSnapshot(id, testMessage)` from a shared snapshot service — same extraction pattern as `runAgentAudit`.

### 10.2 Admin apply — `app/api/admin/agents/[id]/optimize/apply/route.ts`

```typescript
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { agentAuditRun } from '@/db/schema';
import { applyImprovementPlan } from '@/features/agents/server/optimizer-apply';
import type { ImprovementPlan } from '@/features/agents/types/optimizer';

const bodySchema = z.object({
  auditRunId: z.string().min(1),
  changeIds: z.array(z.string().min(1)).min(1).max(20),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = bodySchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: 'Bad Request' }, { status: 400 });

  const { id } = await params;
  const { auditRunId, changeIds } = body.data;

  const [run] = await db
    .select()
    .from(agentAuditRun)
    .where(eq(agentAuditRun.id, auditRunId))
    .limit(1);

  if (!run || run.agentId !== id) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const plan: ImprovementPlan = {
    agentId: id,
    estimatedScoreAfter: 100,
    reasoning: '',
    changes: run.plan as ImprovementPlan['changes'],  // cast here in service layer
  };

  const result = await applyImprovementPlan(auditRunId, id, adminCheck.userId, true, plan, changeIds);
  return Response.json(result);
}
```

### 10.3 Admin history — `app/api/admin/agents/[id]/optimize/history/route.ts`

Separate file — matches the UI's fetch URL `/optimize/history`.

```typescript
import { desc, eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { agentAuditRun } from '@/db/schema';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const runs = await db
    .select({
      id: agentAuditRun.id,
      scoreBefore: agentAuditRun.scoreBefore,
      scoreAfter: agentAuditRun.scoreAfter,
      statusBefore: agentAuditRun.statusBefore,
      statusAfter: agentAuditRun.statusAfter,
      testMessage: agentAuditRun.testMessage,
      appliedChangeIds: agentAuditRun.appliedChangeIds,
      createdAt: agentAuditRun.createdAt,
    })
    .from(agentAuditRun)
    .where(eq(agentAuditRun.agentId, id))
    .orderBy(desc(agentAuditRun.createdAt))
    .limit(20);

  return Response.json({ runs });
}
```

### 10.4 User routes

Mirror the admin routes at `app/api/agents/[id]/optimize/`, `apply/`, and `history/`:
- Replace `requireAdmin()` with `requireUser()`
- Add ownership check: `eq(agent.userId, authResult.user.id)`
- Pass `isAdmin: false` to `applyImprovementPlan`
- History route filters by both `agentId` and `userId` for safety

---

## 11. UI — `features/agents/components/agent-optimizer-panel.tsx`

### 11.1 Generate response type

```typescript
type GenerateResponse = {
  auditRunId: string | null;
  plan: ImprovementPlan;
  scoreBefore: number;       // returned from API — do not hardcode
  statusBefore: string;
};
```

### 11.2 Change grouping

`tool_optimize` is **medium risk** — grouped with content changes (individually confirmed), not with structural apply-all.

```typescript
const structuralChanges = plan.changes.filter((c) => c.type === 'structural');

const contentChanges = plan.changes.filter(
  (c) => c.type !== 'structural',
  // includes: system_prompt, skill_fork, skill_new, tool_optimize
);
```

### 11.3 Component

```tsx
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type {
  ImprovementPlan,
  ImprovementChange,
  StructuralChange,
} from '@/features/agents/types/optimizer';

type Props = {
  agentId: string;
  apiBase: '/api/admin/agents' | '/api/agents';
  initialTestMessage?: string;
};

type GenerateResponse = {
  auditRunId: string | null;
  plan: ImprovementPlan;
  scoreBefore: number;
  statusBefore: string;
};

export function AgentOptimizerPanel({ agentId, apiBase, initialTestMessage }: Props) {
  const queryClient = useQueryClient();
  const [testMessage, setTestMessage] = useState(initialTestMessage ?? '');
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [auditRunId, setAuditRunId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const analyzeMutation = useMutation({
    mutationFn: async (): Promise<GenerateResponse> => {
      const res = await fetch(`${apiBase}/${agentId}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testMessage }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setAuditRunId(data.auditRunId);
      setAppliedIds(new Set());
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (changeIds: string[]) => {
      const res = await fetch(`${apiBase}/${agentId}/optimize/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditRunId, changeIds }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setAppliedIds((prev) => {
        const next = new Set(prev);
        (data.appliedChangeIds as string[]).forEach((id) => next.add(id));
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['agent-audit-history', agentId] });
    },
  });

  const historyQuery = useQuery({
    queryKey: ['agent-audit-history', agentId],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/${agentId}/optimize/history`);
      if (!res.ok) throw new Error('Failed to load history');
      return res.json();
    },
  });

  const plan = result?.plan ?? null;
  const structuralChanges = (plan?.changes ?? []).filter(
    (c): c is StructuralChange => c.type === 'structural',
  );
  const contentChanges = (plan?.changes ?? []).filter((c) => c.type !== 'structural');
  const pendingStructural = structuralChanges.filter((c) => !appliedIds.has(c.id));
  const pendingContent = contentChanges.filter((c) => !appliedIds.has(c.id));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Test message</label>
        <Textarea
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          placeholder="Enter a realistic user message to preview skill activation..."
          rows={2}
        />
      </div>

      <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending}>
        {analyzeMutation.isPending ? 'Analyzing...' : 'Analyze Agent'}
      </Button>

      {analyzeMutation.error && (
        <p className="text-sm text-destructive">{String(analyzeMutation.error)}</p>
      )}

      {plan && result && (
        <div className="space-y-4 rounded-lg border p-4">
          <ScoreBar
            scoreBefore={result.scoreBefore}
            scoreEstimated={plan.estimatedScoreAfter}
          />
          <p className="text-sm text-muted-foreground">{plan.reasoning}</p>

          {pendingStructural.length > 0 && (
            <LowRiskSection
              changes={pendingStructural}
              onApplyAll={() => applyMutation.mutate(pendingStructural.map((c) => c.id))}
              isApplying={applyMutation.isPending}
            />
          )}

          {pendingContent.length > 0 && (
            <ContentChangesSection
              changes={pendingContent}
              onApply={(changeId) => applyMutation.mutate([changeId])}
              isApplying={applyMutation.isPending}
            />
          )}

          {pendingStructural.length === 0 && pendingContent.length === 0 && (
            <p className="text-sm font-medium text-green-600">All changes applied.</p>
          )}
        </div>
      )}

      <AuditHistorySection query={historyQuery} />
    </div>
  );
}

function ScoreBar({ scoreBefore, scoreEstimated }: { scoreBefore: number; scoreEstimated: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium">Readiness</span>
      <div className="flex items-center gap-1.5">
        <span className="text-2xl font-bold tabular-nums">{scoreBefore}</span>
        <span className="text-muted-foreground">→</span>
        <span className="text-2xl font-bold tabular-nums text-green-600">{scoreEstimated}</span>
      </div>
      <span className="text-xs text-muted-foreground">estimated after all fixes</span>
    </div>
  );
}
```

### 11.4 Diff viewer — for `system_prompt`, `skill_fork`, `tool_optimize`

Side-by-side text is sufficient for prompts. No heavy diff library needed.

```tsx
function PromptDiff({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="whitespace-pre-wrap rounded border bg-red-50 p-2 font-mono dark:bg-red-950/20">
        {before}
      </div>
      <div className="whitespace-pre-wrap rounded border bg-green-50 p-2 font-mono dark:bg-green-950/20">
        {after}
      </div>
    </div>
  );
}
```

---

## 12. Wiring into existing pages

### 12.1 Admin agents page (`app/admin/agents/page.tsx`)

```typescript
const ADMIN_VISIBLE_SECTIONS = ['general', 'behavior', 'skills', 'tools', 'mcp', 'optimizer'] as const;
```

```tsx
{activeSection === 'optimizer' && (
  <AgentOptimizerPanel
    agentId={agent.id}
    apiBase="/api/admin/agents"
    initialTestMessage={agent.starterTasks?.[0]?.prompt}
  />
)}
```

### 12.2 User agent editor

Use `apiBase="/api/agents"` and the same component. Find the user-facing agent editor page and add an Optimizer tab following the same pattern.

---

## 13. Edge cases and guards

| Case | Handling |
|------|---------|
| Score already 100 | Return empty plan immediately, skip AI call |
| Skill fork slug collision (`-v2` already taken) | Retry with `${name}-v2-${nanoid(4)}` |
| Skill fork `createSkill` fails due to bad slug from AI | Sanitize: `change.originalSkillName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-\|-$/g, '')` |
| Structural change `currentValue` mismatch | Throw with descriptive message: "Stale plan — re-analyze before applying" |
| Structural `field` not in allowlist | Throw immediately before any DB write |
| Apply partially fails | Continue remaining changes; `errors[]` returned in response |
| Agent deleted between generate and apply | DB select returns empty — return 404 before touching anything |
| `testMessage` longer than 1000 chars | `bodySchema` enforces `.max(1000)` on input |
| `generateObject` returns 0 changes | Valid state — UI shows "Agent is already well configured" |
| `generateObject` throws (model doesn't support structured output) | Catch in route, return `{ error: 'Optimization unavailable for current model slot' }` with status 503 |
| `auditRunId` null (score was already 100) | Apply button not shown — no apply route called |

---

## 14. Build sequence

Follow this order to avoid import errors:

1. `features/agents/server/audit-service.ts` — extract from `audit-report/route.ts`; update the route to call it
2. `features/agents/types/optimizer.ts` — types (imports from audit-service, no other feature deps)
3. `db/schema/agents.ts` — add `agentAuditRun` table (no feature-layer imports)
4. `db/schema.ts` — export `agentAuditRun`
5. Run `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`
6. `features/agents/server/optimizer-schema.ts` — Zod schemas
7. `features/agents/server/optimizer.ts` — plan generation
8. `features/agents/server/optimizer-apply.ts` — plan apply
9. Admin API routes: `optimize/route.ts`, `optimize/apply/route.ts`, `optimize/history/route.ts`
10. User API routes: same three files under `app/api/agents/[id]/`
11. `features/agents/components/agent-optimizer-panel.tsx` — UI
12. Wire into `app/admin/agents/page.tsx`
13. Wire into user agent editor page
14. `pnpm exec tsc --noEmit` — zero errors expected

---

## 15. Key imports reference

```typescript
// DB
import { agent, agentAuditRun, agentSkillAttachment, agentUserToolAttachment } from '@/db/schema';

// AI
import { generateObject } from 'ai';
import { getModelSlot } from '@/lib/ai-config';

// Audit (shared service — no HTTP)
import { runAgentAudit } from '@/features/agents/server/audit-service';

// Skills
import { createSkill, getSkillById } from '@/features/skills/service';

// User tools
import { updateUserTool, getUserToolById } from '@/features/user-tools/service';

// Agent (admin)
import { updateAdminAgentTemplate } from '@/features/agents/server/catalog';

// Auth
import { requireAdmin } from '@/lib/admin';
import { requireUser } from '@/lib/auth-server';
```
