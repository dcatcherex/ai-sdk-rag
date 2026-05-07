import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { agent, agentAuditRun, agentSkill, agentSkillAttachment, agentUserToolAttachment } from '@/db/schema';
import { createSkill } from '@/features/skills/service';
import { getUserToolById, updateUserTool } from '@/features/user-tools/service';
import { updateAdminAgentTemplate } from '@/features/agents/server/catalog';
import { runAgentAudit } from '@/features/agents/server/audit-service';
import {
  AGENT_STRUCTURAL_FIELDS,
  SKILL_ATTACHMENT_STRUCTURAL_FIELDS,
  TOOL_ATTACHMENT_STRUCTURAL_FIELDS,
} from '@/features/agents/types/optimizer';
import type {
  ImprovementPlan,
  ApplyResult,
  StructuralChange,
  SkillForkChange,
  SkillNewChange,
  ToolOptimizeChange,
} from '@/features/agents/types/optimizer';

// ── Structural changes ────────────────────────────────────────────────────────

async function applyStructuralChanges(
  agentId: string,
  userId: string,
  isAdmin: boolean,
  changes: StructuralChange[],
): Promise<void> {
  for (const change of changes) {
    if (change.target === 'agent') {
      if (!AGENT_STRUCTURAL_FIELDS.has(change.field as never)) {
        throw new Error(`Disallowed agent field: ${change.field}`);
      }
      // Pre-check: verify currentValue still matches DB
      const [row] = await db.select().from(agent).where(eq(agent.id, agentId)).limit(1);
      if (!row) throw new Error('Agent not found');
      const actual = row[change.field as keyof typeof row];
      if (JSON.stringify(actual) !== JSON.stringify(change.currentValue)) {
        throw new Error(
          `Stale plan: ${change.field} changed since plan was generated. Re-analyze before applying.`,
        );
      }
      if (isAdmin) {
        await updateAdminAgentTemplate(agentId, { [change.field]: change.suggestedValue } as Parameters<typeof updateAdminAgentTemplate>[1]);
      } else {
        await db
          .update(agent)
          .set({ [change.field]: change.suggestedValue, updatedAt: new Date() })
          .where(and(eq(agent.id, agentId), eq(agent.userId, userId)));
      }
    } else if (change.target === 'skill_attachment') {
      if (!SKILL_ATTACHMENT_STRUCTURAL_FIELDS.has(change.field as never)) {
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
      if (!TOOL_ATTACHMENT_STRUCTURAL_FIELDS.has(change.field as never)) {
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

// ── Skill fork ────────────────────────────────────────────────────────────────

async function applySkillFork(
  agentId: string,
  userId: string,
  change: SkillForkChange,
): Promise<void> {
  const [original] = await db
    .select()
    .from(agentSkill)
    .where(eq(agentSkill.id, change.originalSkillId))
    .limit(1);

  if (!original) throw new Error(`Original skill ${change.originalSkillId} not found`);

  // Derive a valid slug for the fork
  const baseSlug = `${original.name}-v2`;
  let forked;

  try {
    forked = await createSkill(userId, {
      name: baseSlug,
      description: change.descriptionImproved ?? `${original.description ?? original.name} (optimized)`,
      promptFragment: change.improvedPromptFragment,
      activationMode: original.activationMode as 'rule' | 'model',
      triggerType: original.triggerType as 'slash' | 'keyword' | 'always',
      trigger: original.trigger ?? undefined,
      enabledTools: original.enabledTools,
      skillKind: 'inline',
    });
  } catch {
    // Retry with nanoid suffix on slug collision
    forked = await createSkill(userId, {
      name: `${baseSlug}-${nanoid(4)}`,
      description: change.descriptionImproved ?? `${original.description ?? original.name} (optimized)`,
      promptFragment: change.improvedPromptFragment,
      activationMode: original.activationMode as 'rule' | 'model',
      triggerType: original.triggerType as 'slash' | 'keyword' | 'always',
      trigger: original.trigger ?? undefined,
      enabledTools: original.enabledTools,
      skillKind: 'inline',
    });
  }

  // Swap attachment to point at the fork
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

// ── New skill creation ────────────────────────────────────────────────────────

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
  });
}

// ── Tool description optimization ─────────────────────────────────────────────

async function applyToolOptimize(
  userId: string,
  change: ToolOptimizeChange,
): Promise<void> {
  const result = await getUserToolById(change.userToolId, userId);
  if (!result) throw new Error(`Tool ${change.userToolId} not found`);

  await updateUserTool(change.userToolId, { description: change.descriptionAfter }, userId);
}

// ── Main apply function ───────────────────────────────────────────────────────

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

  // 1. Batch structural changes
  const structuralChanges = changesToApply.filter(
    (c): c is StructuralChange => c.type === 'structural',
  );
  try {
    await applyStructuralChanges(agentId, userId, isAdmin, structuralChanges);
    appliedIds.push(...structuralChanges.map((c) => c.id));
  } catch (err) {
    for (const c of structuralChanges) {
      errors.push({ changeId: c.id, error: String(err) });
    }
  }

  // 2. Apply each content change individually
  for (const change of changesToApply) {
    if (change.type === 'structural') continue;

    try {
      switch (change.type) {
        case 'system_prompt':
          if (isAdmin) {
            await updateAdminAgentTemplate(agentId, { systemPrompt: change.after });
          } else {
            await db
              .update(agent)
              .set({ systemPrompt: change.after, updatedAt: new Date() })
              .where(and(eq(agent.id, agentId), eq(agent.userId, userId)));
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

  // 3. Re-run audit for updated score
  const reaudit = await runAgentAudit(agentId, '');
  const scoreAfter = reaudit?.audit.summary.readinessScore ?? 0;
  const statusAfter = reaudit?.audit.summary.status ?? 'unknown';

  // 4. Persist scoreAfter to audit run record
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
