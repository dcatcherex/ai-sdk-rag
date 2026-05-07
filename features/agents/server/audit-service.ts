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

// ── Types ────────────────────────────────────────────────────────────────────

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
  promptPatch: {
    shouldApply: boolean;
    title: string;
    reason: string;
    block: string;
  };
  preview: {
    attachedSkillNames: string[];
    activatedSkillNames: string[];
    activeTools: { id: string; title: string }[];
  };
};

// Serialisable snapshot of the agent config — passed as context to the AI optimizer
export type AgentConfigSnapshot = {
  general: Record<string, unknown>;
  aiBehavior: Record<string, unknown>;
  skills: unknown[];
  tools: unknown[];
  customTools: unknown[];
  mcpServers: unknown[];
};

export type AuditAndSnapshot = {
  audit: AuditResult;
  snapshot: AgentConfigSnapshot;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SCORE_PENALTY: Record<Severity, number> = {
  critical: 30,
  high: 20,
  medium: 10,
  low: 5,
  info: 0,
};

export const PROMPT_POLICY_BLOCK = `<skill_and_tool_policy>
When solving a user request:
1) Check activated skills first, then decide tools.
2) If a relevant skill exists, follow that skill's constraints and intent.
3) Use tools only when they improve correctness, freshness, or execution.
4) Before risky actions (external writes, irreversible actions, costs), ask for explicit user confirmation.
5) If no suitable skill/tool is available, explain the gap and proceed with best-effort reasoning.
6) Never invent tool outputs. If a tool fails, report clearly and propose next safe step.
</skill_and_tool_policy>`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeText(value: string | null): string {
  return (value ?? '').trim();
}

type NormalizedMcpServer = {
  name: string;
  url: string;
  authType: 'none' | 'bearer' | 'api_key' | null;
  credentialKey: string | null;
};

function normalizeMcpServers(value: unknown): NormalizedMcpServer[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const authValue = item.authType;
      const authType =
        authValue === 'none' || authValue === 'bearer' || authValue === 'api_key'
          ? authValue
          : null;
      return {
        name: typeof item.name === 'string' ? item.name : '(unnamed)',
        url: typeof item.url === 'string' ? item.url : '',
        authType,
        credentialKey: typeof item.credentialKey === 'string' ? item.credentialKey : null,
      };
    });
}

function effectiveAttachmentMode(attachmentMode: string | null, skillMode: string): string {
  return attachmentMode ?? skillMode;
}

function effectiveTriggerType(attachmentType: string | null, skillType: string): string {
  return attachmentType ?? skillType;
}

function effectiveTrigger(attachmentTrigger: string | null, skillTrigger: string | null): string {
  return (attachmentTrigger ?? skillTrigger ?? '').trim();
}

// ── Core audit logic ──────────────────────────────────────────────────────────

export async function runAgentAudit(
  agentId: string,
  testMessage: string,
): Promise<AuditAndSnapshot | null> {
  const [agentRow] = await db.select().from(agent).where(eq(agent.id, agentId)).limit(1);
  if (!agentRow) return null;

  const [skillAttachmentRows, customToolRows, knowledgeRows] = await Promise.all([
    db
      .select({ attachment: agentSkillAttachment, skill: agentSkill })
      .from(agentSkillAttachment)
      .innerJoin(agentSkill, eq(agentSkillAttachment.skillId, agentSkill.id))
      .where(eq(agentSkillAttachment.agentId, agentId))
      .orderBy(asc(agentSkillAttachment.priority), asc(agentSkillAttachment.createdAt)),
    db
      .select({ attachment: agentUserToolAttachment, tool: userTool })
      .from(agentUserToolAttachment)
      .innerJoin(userTool, eq(agentUserToolAttachment.userToolId, userTool.id))
      .where(eq(agentUserToolAttachment.agentId, agentId))
      .orderBy(asc(agentUserToolAttachment.priority), asc(agentUserToolAttachment.createdAt)),
    agentRow.documentIds.length > 0
      ? db
          .select({ id: document.id, processingStatus: document.processingStatus })
          .from(document)
          .where(inArray(document.id, agentRow.documentIds))
      : Promise.resolve([]),
  ]);

  const findings: AuditFinding[] = [];
  const recommendedChanges: AuditRecommendedChange[] = [];

  const enabledSkillAttachments = skillAttachmentRows.filter((r) => r.attachment.isEnabled);
  const enabledSkillIds = enabledSkillAttachments.map((r) => r.attachment.skillId);
  const previewSkills = enabledSkillIds.length > 0 ? await getSkillsByIds(enabledSkillIds) : [];

  const skillRuntime =
    previewSkills.length > 0
      ? await resolveSkillRuntimeContext(previewSkills, testMessage)
      : {
          catalogBlock: '',
          activatedSkills: [],
          activeSkillsBlock: '',
          skillResourcesBlock: '',
          skillToolIds: [],
        };

  const systemPrompt = normalizeText(agentRow.systemPrompt);
  const enabledToolIds = agentRow.enabledTools ?? [];
  const allAgentTools = TOOL_MANIFESTS.filter((t) => t.supportsAgent);
  const activeTools =
    enabledToolIds.length === 0
      ? allAgentTools
      : allAgentTools.filter((t) => enabledToolIds.includes(t.id));

  const normalizedMcpServers = normalizeMcpServers(agentRow.mcpServers);

  // ── Prompt findings ──────────────────────────────────────────────────────
  if (systemPrompt.length < 40) {
    findings.push({
      code: 'SYSTEM_PROMPT_TOO_SHORT',
      severity: 'high',
      section: 'aiBehavior',
      message: 'System prompt is too short for reliable behavior control.',
      recommendation: 'Expand role, constraints, style, and tool/skill usage rules.',
      evidence: { length: systemPrompt.length },
    });
    recommendedChanges.push({ section: 'aiBehavior', action: 'review', field: 'systemPrompt', rationale: 'Increase clarity and guardrails.' });
  } else if (systemPrompt.length < 120) {
    findings.push({
      code: 'SYSTEM_PROMPT_LIGHT',
      severity: 'medium',
      section: 'aiBehavior',
      message: 'System prompt is present but likely too lightweight.',
      recommendation: 'Add clearer instructions for decision policy, boundaries, and failure behavior.',
      evidence: { length: systemPrompt.length },
    });
  }

  const systemPromptLower = systemPrompt.toLowerCase();
  if (!systemPromptLower.includes('skill') || !systemPromptLower.includes('tool')) {
    findings.push({
      code: 'PROMPT_MISSING_SKILL_TOOL_POLICY',
      severity: 'medium',
      section: 'aiBehavior',
      message: 'System prompt does not clearly mention skill/tool decision policy.',
      recommendation: 'Add an explicit policy block describing when to use skills and tools.',
    });
  }

  // ── Skill findings ───────────────────────────────────────────────────────
  if (skillAttachmentRows.length === 0) {
    findings.push({ code: 'NO_SKILLS_ATTACHED', severity: 'info', section: 'skills', message: 'No skills are attached to this agent.', recommendation: 'Attach at least one skill if domain specialization is needed.' });
  }

  if (skillAttachmentRows.length > 0 && enabledSkillAttachments.length === 0) {
    findings.push({ code: 'SKILLS_ALL_DISABLED', severity: 'high', section: 'skills', message: 'Skills are attached but all are disabled.', recommendation: 'Enable at least one relevant skill or remove unused attachments.' });
    recommendedChanges.push({ section: 'skills', action: 'review', rationale: 'Current setup prevents any skill injection.' });
  }

  for (const row of enabledSkillAttachments) {
    const mode = effectiveAttachmentMode(row.attachment.activationModeOverride, row.skill.activationMode);
    const triggerType = effectiveTriggerType(row.attachment.triggerTypeOverride, row.skill.triggerType);
    const trigger = effectiveTrigger(row.attachment.triggerOverride, row.skill.trigger);

    if (mode === 'rule' && triggerType !== 'always' && trigger.length === 0) {
      findings.push({
        code: 'RULE_SKILL_MISSING_TRIGGER',
        severity: 'medium',
        section: 'skills',
        message: `Rule-based skill "${row.skill.name}" has no effective trigger.`,
        recommendation: 'Set a keyword/slash trigger or switch activation mode to model.',
        evidence: { skillId: row.skill.id, activationMode: mode, triggerType, trigger },
      });
    }

    if (enabledToolIds.length > 0 && row.skill.enabledTools.length > 0) {
      const overlap = row.skill.enabledTools.some((toolId) => enabledToolIds.includes(toolId));
      if (!overlap) {
        findings.push({
          code: 'SKILL_TOOL_MISMATCH',
          severity: 'medium',
          section: 'tools',
          message: `Skill "${row.skill.name}" references tools not in this agent's allow-list.`,
          recommendation: 'Include at least one required tool in enabled tools or adjust skill tool requirements.',
          evidence: { skillId: row.skill.id, skillEnabledTools: row.skill.enabledTools, agentEnabledTools: enabledToolIds },
        });
      }
    }
  }

  // ── Tool findings ────────────────────────────────────────────────────────
  if (enabledToolIds.length === 0) {
    findings.push({ code: 'TOOLS_ALLOW_ALL', severity: 'low', section: 'tools', message: 'Agent currently allows all built-in agent-capable tools.', recommendation: 'Use an allow-list for production-sensitive agents.' });
    recommendedChanges.push({ section: 'tools', action: 'review', field: 'enabledTools', rationale: 'Narrow tool surface to reduce accidental calls.' });
  }

  if (enabledToolIds.length > 0 && activeTools.length === 0) {
    findings.push({
      code: 'TOOLS_ALLOW_LIST_EMPTY_EFFECTIVE',
      severity: 'high',
      section: 'tools',
      message: 'Tool allow-list does not match any active tool manifests.',
      recommendation: 'Re-select valid tools from the current registry.',
      evidence: { enabledToolIds },
    });
  }

  // ── Custom tool findings ─────────────────────────────────────────────────
  const enabledCustomToolRows = customToolRows.filter((r) => r.attachment.isEnabled);
  const riskyCustomTools = enabledCustomToolRows.filter(
    (r) => !r.tool.readOnly && !r.tool.requiresConfirmation,
  );

  for (const row of enabledCustomToolRows) {
    if (!row.tool.supportsAgent) {
      findings.push({ code: 'CUSTOM_TOOL_NOT_AGENT_CAPABLE', severity: 'high', section: 'customTools', message: `Custom tool "${row.tool.name}" is attached but not agent-capable.`, recommendation: 'Enable agent support or detach this tool.', evidence: { userToolId: row.tool.id } });
    }
    if (row.tool.status !== 'active') {
      findings.push({ code: 'CUSTOM_TOOL_NOT_ACTIVE', severity: 'medium', section: 'customTools', message: `Custom tool "${row.tool.name}" is not active (status: ${row.tool.status}).`, recommendation: 'Activate the tool before relying on it.', evidence: { userToolId: row.tool.id, status: row.tool.status } });
    }
  }

  if (riskyCustomTools.length > 0) {
    findings.push({
      code: 'CUSTOM_TOOL_CONFIRMATION_GAP',
      severity: 'medium',
      section: 'customTools',
      message: 'Some custom tools can perform mutable actions without confirmation.',
      recommendation: 'Enable requiresConfirmation for mutable custom tools.',
      evidence: { toolIds: riskyCustomTools.map((r) => r.tool.id) },
    });
    recommendedChanges.push({ section: 'customTools', action: 'set', field: 'requiresConfirmation', value: true, rationale: 'Protect against unintended write operations.' });
  }

  // ── Knowledge findings ───────────────────────────────────────────────────
  if (agentRow.documentIds.length === 0) {
    findings.push({ code: 'NO_KNOWLEDGE_DOCS', severity: 'info', section: 'knowledge', message: 'No knowledge documents are attached.', recommendation: 'Attach reference docs if this agent should answer from internal knowledge.' });
  }

  const nonReadyDocuments = knowledgeRows.filter((r) => r.processingStatus !== 'ready');
  if (nonReadyDocuments.length > 0) {
    findings.push({ code: 'KNOWLEDGE_DOCS_NOT_READY', severity: 'medium', section: 'knowledge', message: 'Some attached knowledge documents are not ready for retrieval.', recommendation: 'Wait for processing or reprocess failed files.', evidence: { documentIds: nonReadyDocuments.map((r) => r.id) } });
  }

  // ── MCP server findings ──────────────────────────────────────────────────
  for (const server of normalizedMcpServers) {
    if (server.authType === 'none') {
      findings.push({ code: 'MCP_SERVER_NO_AUTH', severity: 'low', section: 'mcpServers', message: `MCP server "${server.name}" uses no authentication.`, recommendation: 'Use bearer/API key auth where possible.', evidence: { name: server.name } });
    }
    if ((server.authType === 'bearer' || server.authType === 'api_key') && !server.credentialKey) {
      findings.push({ code: 'MCP_SERVER_MISSING_CREDENTIAL_KEY', severity: 'medium', section: 'mcpServers', message: `MCP server "${server.name}" requires auth but credential key is missing.`, recommendation: 'Set credentialKey so runtime can resolve credentials.', evidence: { name: server.name, authType: server.authType } });
    }
  }

  // ── Sharing findings ─────────────────────────────────────────────────────
  if (agentRow.isPublic && enabledToolIds.length === 0) {
    findings.push({ code: 'PUBLIC_AGENT_WITH_ALL_TOOLS', severity: 'high', section: 'sharing', message: 'Public agent has all built-in tools enabled.', recommendation: 'Restrict tool allow-list before sharing publicly.' });
  }
  if (agentRow.isPublic && riskyCustomTools.length > 0) {
    findings.push({ code: 'PUBLIC_AGENT_RISKY_CUSTOM_TOOLS', severity: 'high', section: 'sharing', message: 'Public agent has mutable custom tools without confirmation.', recommendation: 'Enable confirmation or disable risky custom tools before public sharing.' });
  }

  // ── General findings ─────────────────────────────────────────────────────
  if (!agentRow.modelId) {
    findings.push({ code: 'MODEL_AUTO_SELECTION', severity: 'info', section: 'general', message: 'Agent is using automatic model selection.', recommendation: 'Pin modelId for deterministic behavior.' });
  }

  if (testMessage.trim().length > 0 && enabledSkillAttachments.length > 0 && skillRuntime.activatedSkills.length === 0) {
    findings.push({ code: 'TEST_MESSAGE_NO_SKILL_ACTIVATION', severity: 'low', section: 'previewPrompt', message: 'No skills activated for the provided test message.', recommendation: 'Adjust triggers/activation mode for this use case.', evidence: { testMessage, enabledSkillIds } });
  }

  // ── Scoring ──────────────────────────────────────────────────────────────
  const severityCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) severityCounts[f.severity] += 1;

  const totalPenalty = findings.reduce((sum, f) => sum + SCORE_PENALTY[f.severity], 0);
  const readinessScore = Math.max(0, 100 - totalPenalty);
  const status: AuditResult['summary']['status'] =
    severityCounts.critical > 0 || severityCounts.high > 0
      ? 'needs_attention'
      : severityCounts.medium > 1
        ? 'improve'
        : 'ready';

  const promptPatchShouldApply =
    !systemPromptLower.includes('skill') ||
    !systemPromptLower.includes('tool') ||
    findings.some((f) => f.code === 'PROMPT_MISSING_SKILL_TOOL_POLICY');

  if (promptPatchShouldApply) {
    recommendedChanges.push({
      section: 'aiBehavior',
      action: 'add',
      field: 'systemPrompt',
      value: PROMPT_POLICY_BLOCK,
      rationale: 'Add explicit decision policy for skills/tools.',
    });
  }

  // ── Build snapshot for optimizer ─────────────────────────────────────────
  const snapshot: AgentConfigSnapshot = {
    general: {
      id: agentRow.id,
      name: agentRow.name,
      description: agentRow.description,
      modelId: agentRow.modelId,
      isPublic: agentRow.isPublic,
      isTemplate: agentRow.isTemplate,
    },
    aiBehavior: {
      systemPrompt: agentRow.systemPrompt,
      structuredBehavior: agentRow.structuredBehavior,
    },
    skills: skillAttachmentRows.map((r) => ({
      skillId: r.skill.id,
      skillName: r.skill.name,
      description: r.skill.description,
      promptFragment: r.skill.promptFragment,
      activationMode: effectiveAttachmentMode(r.attachment.activationModeOverride, r.skill.activationMode),
      triggerType: effectiveTriggerType(r.attachment.triggerTypeOverride, r.skill.triggerType),
      trigger: effectiveTrigger(r.attachment.triggerOverride, r.skill.trigger),
      isEnabled: r.attachment.isEnabled,
      enabledTools: r.skill.enabledTools,
    })),
    tools: {
      mode: enabledToolIds.length === 0 ? 'all' : 'allow_list',
      enabledToolIds,
      activeTools: activeTools.map((t) => ({ id: t.id, title: t.title })),
    } as unknown as unknown[],
    customTools: enabledCustomToolRows.map((r) => ({
      id: r.tool.id,
      name: r.tool.name,
      description: r.tool.description,
      readOnly: r.tool.readOnly,
      requiresConfirmation: r.tool.requiresConfirmation,
      supportsAgent: r.tool.supportsAgent,
      status: r.tool.status,
    })),
    mcpServers: normalizedMcpServers,
  };

  const audit: AuditResult = {
    agentId,
    generatedAt: new Date().toISOString(),
    summary: { readinessScore, status, totalFindings: findings.length, severityCounts, testMessageUsed: testMessage },
    context: {
      isPublic: agentRow.isPublic,
      modelId: agentRow.modelId,
      toolMode: enabledToolIds.length === 0 ? 'all_tools' : 'allow_list',
      activeToolCount: activeTools.length,
      attachedSkillCount: skillAttachmentRows.length,
      enabledSkillCount: enabledSkillAttachments.length,
      activatedSkillCount: skillRuntime.activatedSkills.length,
      knowledgeDocCount: agentRow.documentIds.length,
      customToolCount: customToolRows.length,
      enabledCustomToolCount: enabledCustomToolRows.length,
      mcpServerCount: normalizedMcpServers.length,
    },
    findings,
    recommendedChanges,
    promptPatch: {
      shouldApply: promptPatchShouldApply,
      title: 'Skill and Tool Decision Policy',
      reason: promptPatchShouldApply
        ? 'Current prompt lacks explicit operational policy for skills/tools.'
        : 'Prompt already includes skill/tool policy language.',
      block: PROMPT_POLICY_BLOCK,
    },
    preview: {
      attachedSkillNames: previewSkills.map((s) => s.name),
      activatedSkillNames: skillRuntime.activatedSkills.map((e) => e.skill.name),
      activeTools: activeTools.map((t) => ({ id: t.id, title: t.title })),
    },
  };

  return { audit, snapshot };
}
