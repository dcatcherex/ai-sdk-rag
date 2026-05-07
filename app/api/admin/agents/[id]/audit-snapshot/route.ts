import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import {
  agent,
  agentShare,
  agentSkill,
  agentSkillAttachment,
  agentUserToolAttachment,
  document,
  user as userTable,
  userTool,
} from '@/db/schema';
import { assembleSystemPrompt } from '@/features/chat/server/prompt-assembly';
import { resolveEffectiveBrand } from '@/features/agents/server/brand-resolution';
import { TOOL_MANIFESTS } from '@/features/tools/registry/client';
import { getSkillsByIds, resolveSkillRuntimeContext } from '@/features/skills/service';
import { resolveSystemPromptTemplate } from '@/lib/prompt';

const querySchema = z.object({
  testMessage: z.string().max(1000).optional(),
});

type PromptBlock = {
  label: string;
  content: string;
  tokens: number;
  note?: string;
};

function toTokenEstimate(value: string): number {
  return Math.ceil(value.length / 4);
}

function pickDocumentTitle(metadata: unknown, fallback: string): string {
  if (typeof metadata !== 'object' || metadata === null) {
    return fallback;
  }

  const title = (metadata as Record<string, unknown>).title;
  if (typeof title === 'string' && title.trim().length > 0) {
    return title;
  }

  return fallback;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const parsedQuery = querySchema.safeParse({
    testMessage: new URL(req.url).searchParams.get('testMessage') ?? undefined,
  });
  if (!parsedQuery.success) {
    return Response.json({ error: 'Bad Request' }, { status: 400 });
  }

  const [agentRow] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, id))
    .limit(1);

  if (!agentRow) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const [shareRows, skillAttachmentRows, customToolRows, knowledgeRows] = await Promise.all([
    db
      .select({
        userId: userTable.id,
        name: userTable.name,
        email: userTable.email,
        image: userTable.image,
      })
      .from(agentShare)
      .innerJoin(userTable, eq(agentShare.sharedWithUserId, userTable.id))
      .where(eq(agentShare.agentId, id)),
    db
      .select({
        attachment: agentSkillAttachment,
        skill: agentSkill,
      })
      .from(agentSkillAttachment)
      .innerJoin(agentSkill, eq(agentSkillAttachment.skillId, agentSkill.id))
      .where(eq(agentSkillAttachment.agentId, id))
      .orderBy(asc(agentSkillAttachment.priority), asc(agentSkillAttachment.createdAt)),
    db
      .select({
        attachment: agentUserToolAttachment,
        tool: userTool,
      })
      .from(agentUserToolAttachment)
      .innerJoin(userTool, eq(agentUserToolAttachment.userToolId, userTool.id))
      .where(eq(agentUserToolAttachment.agentId, id))
      .orderBy(asc(agentUserToolAttachment.priority), asc(agentUserToolAttachment.createdAt)),
    agentRow.documentIds.length > 0
      ? db
          .select({
            id: document.id,
            processingStatus: document.processingStatus,
            metadata: document.metadata,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          })
          .from(document)
          .where(inArray(document.id, agentRow.documentIds))
      : Promise.resolve([]),
  ]);

  const enabledSkillIds = skillAttachmentRows
    .filter((row) => row.attachment.isEnabled)
    .map((row) => row.attachment.skillId);
  const previewSkills = enabledSkillIds.length > 0 ? await getSkillsByIds(enabledSkillIds) : [];
  const testMessage = parsedQuery.data.testMessage ?? '';
  const skillRuntime = previewSkills.length > 0
    ? await resolveSkillRuntimeContext(previewSkills, testMessage)
    : {
        catalogBlock: '',
        activatedSkills: [],
        activeSkillsBlock: '',
        skillResourcesBlock: '',
        skillToolIds: [],
      };

  const brandResolution = await resolveEffectiveBrand({
    userId: adminCheck.session.user.id,
    activeBrandId: null,
    agent: {
      brandId: agentRow.brandId,
      brandMode: agentRow.brandMode,
      brandAccessPolicy: agentRow.brandAccessPolicy,
      requiresBrandForRun: agentRow.requiresBrandForRun,
      fallbackBehavior: agentRow.fallbackBehavior,
    },
  });

  const baseSystemPrompt = resolveSystemPromptTemplate(agentRow.systemPrompt);
  const assembledPrompt = assembleSystemPrompt({
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

  const enabledToolIds = agentRow.enabledTools ?? [];
  const activeTools = enabledToolIds.length === 0
    ? TOOL_MANIFESTS.filter((tool) => tool.supportsAgent)
    : TOOL_MANIFESTS.filter((tool) => tool.supportsAgent && enabledToolIds.includes(tool.id));
  const toolsBlockContent = activeTools.length > 0
    ? activeTools.map((tool) => `• ${tool.title} (${tool.id})`).join('\n')
    : '(none — all tools disabled)';

  const blocks: PromptBlock[] = [
    {
      label: 'System Prompt',
      content: baseSystemPrompt,
      tokens: toTokenEstimate(baseSystemPrompt),
    },
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
          tokens: toTokenEstimate(brandResolution.promptInstruction),
        }]
      : []),
    ...(skillRuntime.catalogBlock
      ? [{
          label: 'Skill Catalog',
          content: skillRuntime.catalogBlock.trim(),
          tokens: toTokenEstimate(skillRuntime.catalogBlock),
        }]
      : []),
    ...(skillRuntime.activeSkillsBlock
      ? [{
          label: 'Active Skills',
          content: skillRuntime.activeSkillsBlock.trim(),
          tokens: toTokenEstimate(skillRuntime.activeSkillsBlock),
        }]
      : []),
    ...(skillRuntime.skillResourcesBlock
      ? [{
          label: 'Skill Resources',
          content: skillRuntime.skillResourcesBlock.trim(),
          tokens: toTokenEstimate(skillRuntime.skillResourcesBlock),
        }]
      : []),
    {
      label: 'Tools Available',
      content: toolsBlockContent,
      tokens: 0,
      note: 'Passed as tool definitions — not injected into the prompt text.',
    },
  ];

  return Response.json({
    fetchedAt: new Date().toISOString(),
    agentId: agentRow.id,
    general: {
      id: agentRow.id,
      userId: agentRow.userId,
      name: agentRow.name,
      description: agentRow.description,
      imageUrl: agentRow.imageUrl,
      modelId: agentRow.modelId,
      isPublic: agentRow.isPublic,
      isDefault: agentRow.isDefault,
      isTemplate: agentRow.isTemplate,
      managedByAdmin: agentRow.managedByAdmin,
      starterTasks: agentRow.starterTasks,
      createdAt: agentRow.createdAt,
      updatedAt: agentRow.updatedAt,
    },
    aiBehavior: {
      systemPrompt: agentRow.systemPrompt,
      structuredBehavior: agentRow.structuredBehavior,
      brandId: agentRow.brandId,
      brandMode: agentRow.brandMode,
      brandAccessPolicy: agentRow.brandAccessPolicy,
      requiresBrandForRun: agentRow.requiresBrandForRun,
      fallbackBehavior: agentRow.fallbackBehavior,
    },
    skills: {
      attachmentCount: skillAttachmentRows.length,
      enabledSkillIds,
      attachments: skillAttachmentRows.map((row) => ({
        id: row.attachment.id,
        skillId: row.attachment.skillId,
        isEnabled: row.attachment.isEnabled,
        activationModeOverride: row.attachment.activationModeOverride,
        discoveryModeOverride: row.attachment.discoveryModeOverride,
        triggerTypeOverride: row.attachment.triggerTypeOverride,
        triggerOverride: row.attachment.triggerOverride,
        priority: row.attachment.priority,
        notes: row.attachment.notes,
        skill: {
          id: row.skill.id,
          userId: row.skill.userId,
          name: row.skill.name,
          description: row.skill.description,
          triggerType: row.skill.triggerType,
          trigger: row.skill.trigger,
          activationMode: row.skill.activationMode,
          discoveryMode: row.skill.discoveryMode,
          enabledTools: row.skill.enabledTools,
          sourceUrl: row.skill.sourceUrl,
          sourceId: row.skill.sourceId,
          updatedAt: row.skill.updatedAt,
        },
      })),
    },
    knowledge: {
      documentIds: agentRow.documentIds,
      documents: knowledgeRows.map((row) => ({
        id: row.id,
        title: pickDocumentTitle(row.metadata, row.id),
        processingStatus: row.processingStatus,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    },
    tools: {
      mode: enabledToolIds.length === 0 ? 'all_tools' : 'allow_list',
      enabledToolIds,
      activeTools: activeTools.map((tool) => ({
        id: tool.id,
        slug: tool.slug,
        title: tool.title,
        description: tool.description,
        category: tool.category,
        supportsAgent: tool.supportsAgent,
      })),
    },
    customTools: {
      attachmentCount: customToolRows.length,
      attachments: customToolRows.map((row) => ({
        id: row.attachment.id,
        userToolId: row.attachment.userToolId,
        isEnabled: row.attachment.isEnabled,
        priority: row.attachment.priority,
        notes: row.attachment.notes,
        tool: {
          id: row.tool.id,
          userId: row.tool.userId,
          name: row.tool.name,
          slug: row.tool.slug,
          description: row.tool.description,
          executionType: row.tool.executionType,
          visibility: row.tool.visibility,
          status: row.tool.status,
          readOnly: row.tool.readOnly,
          requiresConfirmation: row.tool.requiresConfirmation,
          supportsAgent: row.tool.supportsAgent,
          activeVersion: row.tool.activeVersion,
          updatedAt: row.tool.updatedAt,
        },
      })),
    },
    mcpServers: agentRow.mcpServers,
    sharing: {
      isPublic: agentRow.isPublic,
      sharedWith: shareRows.map((row) => ({
        id: row.userId,
        name: row.name,
        email: row.email,
        image: row.image,
      })),
    },
    previewPrompt: {
      testMessage,
      assembled: assembledPrompt,
      estimatedTokens: toTokenEstimate(assembledPrompt),
      attachedSkillCount: previewSkills.length,
      attachedSkillNames: previewSkills.map((skill) => skill.name),
      activatedSkillCount: skillRuntime.activatedSkills.length,
      activatedSkillNames: skillRuntime.activatedSkills.map((entry) => entry.skill.name),
      activeTools: activeTools.map((tool) => ({ id: tool.id, title: tool.title })),
      brandResolution: {
        mode: brandResolution.mode,
        reason: brandResolution.reason,
        effectiveBrandName: brandResolution.effectiveBrand?.name ?? null,
        canOverride: brandResolution.canOverride,
        blocked: brandResolution.shouldBlock,
      },
      blocks,
    },
  });
}
