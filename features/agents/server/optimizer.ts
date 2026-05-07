import { generateObject, NoObjectGeneratedError } from 'ai';
import { nanoid } from 'nanoid';
import { getModelSlot } from '@/lib/ai-config';
import type { AuditResult, AgentConfigSnapshot } from './audit-service';
import { improvementPlanSchema } from './optimizer-schema';
import type { ImprovementPlan } from '@/features/agents/types/optimizer';

const OPTIMIZER_SYSTEM = `You are an expert AI agent configuration optimizer for Vaja AI platform.

Your job: analyze an agent's full configuration snapshot and audit findings, then produce a concrete, apply-ready improvement plan.

## Rules

1. Every change must have a unique id — use a short descriptive slug (e.g. "fix-trigger-sales-brief", "rewrite-prompt").
2. Only suggest changes you have evidence for from the audit findings or snapshot.
3. For structural changes (target: agent / skill_attachment / tool_attachment):
   - agent fields allowed: enabledTools, modelId
   - skill_attachment fields allowed: isEnabled, activationModeOverride, discoveryModeOverride, triggerTypeOverride, triggerOverride, priority
   - tool_attachment fields allowed: requiresConfirmation, isEnabled
   - Provide exact suggestedValue (e.g. ["web-search", "rag"] not "add search tools").
   - Include currentValue matching the snapshot exactly.
4. For system_prompt: preserve the agent's role and tone. Improve clarity, add decision policy, add constraints. Do NOT change the agent's core purpose.
5. For skill_fork: write production-ready promptFragment in SKILL.md style. Start with a role statement, then numbered rules. No filler.
6. For skill_new: only when there is a clear capability gap that no existing skill covers. skillName must be a lowercase-hyphen slug (regex /^[a-z0-9]+(?:-[a-z0-9]+)*$/, max 64 chars).
7. For tool_optimize: rewrite descriptions to be action-oriented ("Searches the web for current prices" not "A tool that searches"). Param descriptions should explain expected format and when to pass the value.
8. estimatedScoreAfter: be realistic. Start at current score, subtract remaining penalties for findings you do NOT fix.
9. Maximum 20 changes per plan.
10. reasoning: 1-2 sentences on the overall strategy.

## Language
Agent prompts may be Thai or English. Match the language of the existing systemPrompt when rewriting.`;

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

1. structural
{
  "id": "enable-web-search",
  "title": "Enable web search",
  "rationale": "The audit found missing freshness support for current-info tasks.",
  "section": "tools",
  "type": "structural",
  "risk": "low",
  "target": "agent",
  "field": "enabledTools",
  "currentValue": ["rag"],
  "suggestedValue": ["rag", "web-search"]
}

2. system_prompt
{
  "id": "rewrite-system-prompt",
  "title": "Strengthen decision policy",
  "rationale": "The audit found missing tool and skill decision rules.",
  "section": "aiBehavior",
  "type": "system_prompt",
  "risk": "high",
  "before": "current prompt text",
  "after": "improved prompt text"
}

3. skill_fork
{
  "id": "fork-sales-skill",
  "title": "Fork sales skill for stronger qualification flow",
  "rationale": "The attached skill is relevant but underspecified.",
  "section": "skills",
  "type": "skill_fork",
  "risk": "medium",
  "originalSkillId": "skill_123",
  "originalSkillName": "sales-qualification",
  "improvedPromptFragment": "You are..."
}

4. skill_new
{
  "id": "add-briefing-skill",
  "title": "Add a briefing skill",
  "rationale": "No existing skill covers this recurring task.",
  "section": "skills",
  "type": "skill_new",
  "risk": "medium",
  "skillName": "daily-briefing",
  "skillDescription": "Creates concise daily briefings.",
  "promptFragment": "You are...",
  "activationMode": "rule",
  "triggerType": "keyword",
  "trigger": "daily briefing"
}

5. tool_optimize
{
  "id": "tighten-rag-tool-copy",
  "title": "Clarify knowledge tool description",
  "rationale": "The current tool description is too vague.",
  "section": "tools",
  "type": "tool_optimize",
  "risk": "medium",
  "userToolId": "tool_123",
  "toolName": "Knowledge Search",
  "descriptionBefore": "A tool that searches documents.",
  "descriptionAfter": "Searches connected documents for evidence-backed answers.",
  "parameterChanges": []
}

Important:
- Do not invent fields such as action, suggested dValue, or field:"systemPrompt" for prompt rewrites.
- If you are rewriting the system prompt, use type "system_prompt" with before and after.
- Risk is fixed by type: structural=low, system_prompt=high, skill_fork=medium, skill_new=medium, tool_optimize=medium.
- Use only one change shape per item; do not mix schemas.
- Return valid JSON only.`;

function buildOptimizerPrompt(
  agentId: string,
  audit: AuditResult,
  snapshot: AgentConfigSnapshot,
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

function getErrorValue(error: NoObjectGeneratedError): unknown {
  if ('value' in error) {
    return (error as NoObjectGeneratedError & { value?: unknown }).value;
  }

  const cause = 'cause' in error ? (error as NoObjectGeneratedError & { cause?: unknown }).cause : undefined;
  if (cause && typeof cause === 'object' && 'value' in cause) {
    return (cause as { value?: unknown }).value;
  }

  return undefined;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeChange(rawChange: unknown): Record<string, unknown> | null {
  const change = toRecord(rawChange);
  if (!change) return null;

  const normalized: Record<string, unknown> = { ...change };
  const type = typeof normalized.type === 'string' ? normalized.type : undefined;
  const target = typeof normalized.target === 'string' ? normalized.target : undefined;

  if (type === 'structural') {
    normalized.risk = 'low';
    if (target === 'skill_attachment') {
      if (normalized.field === 'trigger') normalized.field = 'triggerOverride';
      if (normalized.field === 'triggerType') normalized.field = 'triggerTypeOverride';
      if (normalized.field === 'activationMode') normalized.field = 'activationModeOverride';
      if (normalized.field === 'discoveryMode') normalized.field = 'discoveryModeOverride';
    }
  } else if (type === 'system_prompt') {
    normalized.risk = 'high';
  } else if (type === 'skill_fork' || type === 'skill_new' || type === 'tool_optimize') {
    normalized.risk = 'medium';
  }

  return normalized;
}

function normalizePlanCandidate(raw: unknown, agentId: string): unknown {
  const plan = toRecord(raw);
  if (!plan) return raw;

  const normalized: Record<string, unknown> = { ...plan };
  normalized.agentId = typeof normalized.agentId === 'string' && normalized.agentId.length > 0
    ? normalized.agentId
    : agentId;

  if (Array.isArray(normalized.changes)) {
    normalized.changes = normalized.changes
      .map((change) => normalizeChange(change))
      .filter((change): change is Record<string, unknown> => change !== null);
  }

  return normalized;
}

function recoverPlanFromError(error: NoObjectGeneratedError, agentId: string): ImprovementPlan | null {
  const candidate = normalizePlanCandidate(getErrorValue(error), agentId);
  const parsed = improvementPlanSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return parsed.data as ImprovementPlan;
}

export async function generateImprovementPlan(
  agentId: string,
  audit: AuditResult,
  snapshot: AgentConfigSnapshot,
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
