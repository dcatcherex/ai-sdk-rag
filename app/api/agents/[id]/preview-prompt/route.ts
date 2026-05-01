import { NextResponse } from 'next/server';
import { and, eq, or, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { agent } from '@/db/schema';
import { getSkillsForAgent, getSkillsByIds, resolveSkillRuntimeContext } from '@/features/skills/service';
import { assembleSystemPrompt } from '@/features/chat/server/prompt-assembly';
import { resolveEffectiveBrand } from '@/features/agents/server/brand-resolution';
import {
  brandAccessPolicySchema,
  brandModeSchema,
  fallbackBehaviorSchema,
} from '@/features/agents/server/brand-config';
import { resolveSystemPromptTemplate } from '@/lib/prompt';
import { TOOL_MANIFESTS } from '@/features/tools/registry/client';

const bodySchema = z.object({
  testMessage: z.string().max(1000).optional(),
  // Current in-editor state — overrides what's saved in the DB
  skillIds: z.array(z.string()).optional(),
  enabledTools: z.array(z.string()).optional(),
  activeBrandId: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  brandMode: brandModeSchema.optional(),
  brandAccessPolicy: brandAccessPolicySchema.optional(),
  requiresBrandForRun: z.boolean().optional(),
  fallbackBehavior: fallbackBehaviorSchema.optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const {
    testMessage,
    skillIds,
    enabledTools,
    activeBrandId,
    brandId,
    brandMode,
    brandAccessPolicy,
    requiresBrandForRun,
    fallbackBehavior,
  } = bodySchema.parse(body);

  const [agentRow] = await db
    .select()
    .from(agent)
    .where(
      and(
        eq(agent.id, id),
        or(
          eq(agent.userId, authResult.user.id),
          and(isNull(agent.userId), eq(agent.managedByAdmin, true)),
        ),
      ),
    )
    .limit(1);

  if (!agentRow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const baseSystemPrompt = resolveSystemPromptTemplate(agentRow.systemPrompt);

  // Use in-editor skill IDs if provided, otherwise fall back to DB-saved attachments
  const skills = skillIds !== undefined
    ? (skillIds.length > 0 ? await getSkillsByIds(skillIds) : [])
    : await getSkillsForAgent(id);

  const skillRuntime = skills.length > 0
    ? await resolveSkillRuntimeContext(skills, testMessage ?? '')
    : {
        catalogBlock: '',
        activatedSkills: [],
        activeSkillsBlock: '',
        skillResourcesBlock: '',
        skillToolIds: [],
      };

  const brandResolution = await resolveEffectiveBrand({
    userId: authResult.user.id,
    activeBrandId: activeBrandId ?? null,
    agent: {
      brandId: brandId ?? agentRow.brandId,
      brandMode: brandMode ?? agentRow.brandMode,
      brandAccessPolicy: brandAccessPolicy ?? agentRow.brandAccessPolicy,
      requiresBrandForRun: requiresBrandForRun ?? agentRow.requiresBrandForRun,
      fallbackBehavior: fallbackBehavior ?? agentRow.fallbackBehavior,
    },
  });

  const assembled = assembleSystemPrompt({
    base: baseSystemPrompt,
    conversationSummaryBlock: '',
    threadWorkingMemoryBlock: '',
    isGrounded: false,
    activeBrand: brandResolution.effectiveBrand,
    memoryContext: '',
    sharedMemoryBlock: '',
    domainContextBlock: '',
    domainSetupBlock: '',
    skillRuntime,
    examPrepBlock: '',
    certBlock: '',
    quizContextBlock: '',
  }) + (brandResolution.promptInstruction
    ? `\n\n<brand_resolution>\n${brandResolution.promptInstruction}\n</brand_resolution>`
    : '');

  const estimatedTokens = Math.ceil(assembled.length / 4);

  // Resolve active tool names from the registry
  const activeToolIds = enabledTools !== undefined ? enabledTools : (agentRow.enabledTools ?? []);
  const activeTools = activeToolIds.length === 0
    ? TOOL_MANIFESTS.filter((t) => t.supportsAgent)
    : TOOL_MANIFESTS.filter((t) => t.supportsAgent && activeToolIds.includes(t.id));

  const toolsBlockContent = activeTools.length > 0
    ? activeTools.map((t) => `• ${t.title} (${t.id})`).join('\n')
    : '(none — all tools disabled)';

  const blocks = [
    { label: 'System Prompt', content: baseSystemPrompt, tokens: Math.ceil(baseSystemPrompt.length / 4) },
    ...(brandResolution.effectiveBrand
      ? [{
          label: 'Brand Context',
          content: `Resolved brand: ${brandResolution.effectiveBrand.name}`,
          tokens: 0,
          note: `Mode: ${brandResolution.mode}. Reason: ${brandResolution.reason}.`,
        }]
      : []),
    ...(brandResolution.promptInstruction
      ? [{
          label: 'Brand Resolution Instruction',
          content: brandResolution.promptInstruction,
          tokens: Math.ceil(brandResolution.promptInstruction.length / 4),
        }]
      : []),
    ...(skillRuntime.catalogBlock ? [{ label: 'Skill Catalog', content: skillRuntime.catalogBlock.trim(), tokens: Math.ceil(skillRuntime.catalogBlock.length / 4) }] : []),
    ...(skillRuntime.activeSkillsBlock ? [{ label: 'Active Skills', content: skillRuntime.activeSkillsBlock.trim(), tokens: Math.ceil(skillRuntime.activeSkillsBlock.length / 4) }] : []),
    ...(skillRuntime.skillResourcesBlock ? [{ label: 'Skill Resources', content: skillRuntime.skillResourcesBlock.trim(), tokens: Math.ceil(skillRuntime.skillResourcesBlock.length / 4) }] : []),
    { label: 'Tools Available', content: toolsBlockContent, tokens: 0, note: 'Passed as tool definitions — not injected into the prompt text.' },
  ];

  return NextResponse.json({
    assembled,
    estimatedTokens,
    activatedSkillCount: skillRuntime.activatedSkills.length,
    activatedSkillNames: skillRuntime.activatedSkills.map((e) => e.skill.name),
    attachedSkillCount: skills.length,
    attachedSkillNames: skills.map((s) => s.name),
    activeTools: activeTools.map((t) => ({ id: t.id, title: t.title })),
    brandResolution: {
      mode: brandResolution.mode,
      reason: brandResolution.reason,
      effectiveBrandName: brandResolution.effectiveBrand?.name ?? null,
      canOverride: brandResolution.canOverride,
      blocked: brandResolution.shouldBlock,
    },
    blocks,
  });
}
