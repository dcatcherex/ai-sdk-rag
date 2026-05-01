import 'server-only';

import { convertToModelMessages, generateText, stepCountIs, type ToolSet } from 'ai';
import { eq } from 'drizzle-orm';
import { availableModels, chatModel } from '@/lib/ai';
import { db } from '@/lib/db';
import { agent } from '@/db/schema';
import { getUserMemoryContext } from '@/lib/memory';
import { buildToolSet } from '@/lib/tools';
import { buildResponsePlan } from '@/features/response-format';
import { listResponseWorkflowCapabilities } from '@/features/privacy-governance/access-control';
import { createAgentTools } from '@/lib/agent-tools';
import { buildMCPToolSet } from '@/lib/tools/mcp';
import { getCreditCost } from '@/lib/credits';
import { buildBrandImageContext, buildImageBrandSuffix } from '@/features/brands/service';
import type { Brand } from '@/features/brands/types';
import type { Agent } from '@/features/agents/types';
import { renderDomainContextPromptBlock } from '@/features/domain-profiles/server/prompt';
import { buildDomainSetupPromptBlock } from '@/features/domain-profiles/server/setup';
import type { DomainProfileOwnerContext, ResolvedDomainContext } from '@/features/domain-profiles/types';
import type { SkillRuntimeContext } from '@/features/skills/server/activation';
import { buildUserCreatedToolSet } from '@/features/user-tools/service';
import {
  buildAgentRunSystemPrompt,
  EMPTY_SKILL_RUNTIME,
  mergeAgentDocumentIds,
  mergeAgentToolIds,
  resolveAgentBaseSystemPrompt,
  resolveAgentBrandRuntime,
  resolveAgentSkillRuntime,
} from './runtime';
import {
  getModelByIntent,
  toolDisabledModels,
} from '@/features/chat/server/routing';
import {
  inferChatImageTaskHint,
  resolveAdminImageModel,
} from '@/features/image/model-selection';
import { triggerImageGeneration } from '@/features/image/service';
import { wantsImageGeneration } from './media-intent';
import {
  buildFallbackDiagnosisContract,
  buildAgentRunModelMessages,
  buildToolResultsFallbackContext,
  collectToolImageUrls,
  containsLikelyUnexpectedEnglish,
  extractNamedToolPayload,
  formatFarmRecordSummary,
  getLastUserPromptFromRunMessages,
  hasRequiredHeadings,
  inferFarmRecordSummaryRequest,
  isThaiText,
  looksLikeDiagnosisRequest,
  looksLikeRecordSummaryRequest,
} from './run-helpers';
import type {
  AgentRunImageStartedResult,
  AgentRunInputMessage,
  AgentRunRequest,
  AgentRunResult,
  AgentRunTextResult,
} from './run-types';

type PreparedAgentRunChannelContext = {
  baseToolIds?: string[] | null;
  memoryContext?: string;
  sharedMemoryBlock?: string;
  lineChannelId?: string;
  domainContextBlock?: string;
  domainSetupBlock?: string;
  threadWorkingMemoryBlock?: string;
  conversationSummaryBlock?: string;
  examPrepBlock?: string;
  certBlock?: string;
  quizContextBlock?: string;
  extraBlocks?: Array<string | null | undefined>;
  rerankEnabled?: boolean;
  referenceImageUrls?: string[];
  mcpCredentials?: Record<string, string>;
  agentOverride?: Agent | null;
  baseSystemPromptOverride?: string;
  userScores?: Map<string, number>;
  toolsOverride?: ToolSet;
  skillRuntimeOverride?: SkillRuntimeContext;
};

export type PreparedAgentImageRun = {
  prompt: string;
  modelId: string;
  creditCost: number;
  enablePro?: boolean;
  taskHint?: ReturnType<typeof inferChatImageTaskHint>;
  imageUrls?: string[];
  source: 'chat' | 'agent' | 'shared_link' | 'line';
};

export type PreparedAgentRun = {
  request: AgentRunRequest;
  agent: Agent | null;
  lastUserPrompt: string | null;
  activeBrand: Brand | null;
  effectiveDocumentIds?: string[];
  activeToolIds: string[] | null;
  supportsTools: boolean;
  modelId: string;
  routingReason: string;
  creditCost: number;
  systemPrompt: string;
  memoryContext: string;
  skillRuntime: SkillRuntimeContext;
  tools?: ToolSet;
};

function getChannelContext(request: AgentRunRequest): PreparedAgentRunChannelContext {
  return (request.channelContext ?? {}) as PreparedAgentRunChannelContext;
}

function getDomainProfileOwnerContext(
  request: AgentRunRequest,
  lineChannelId?: string,
): DomainProfileOwnerContext | null {
  if (request.identity.userId) {
    return {
      userId: request.identity.userId,
    };
  }

  if (
    request.identity.channel === 'line' &&
    request.identity.lineUserId &&
    lineChannelId
  ) {
    return {
      lineUserId: request.identity.lineUserId,
      channelId: lineChannelId,
    };
  }

  return null;
}

async function resolveDomainPromptContext(input: {
  request: AgentRunRequest;
  lineChannelId?: string;
  userMessage: string | null;
}): Promise<ResolvedDomainContext | null> {
  const owner = getDomainProfileOwnerContext(input.request, input.lineChannelId);
  if (!owner) {
    return null;
  }

  const { resolveRelevantDomainContext } = await import('@/features/domain-profiles/service');
  return resolveRelevantDomainContext(
    {
      userMessage: input.userMessage ?? undefined,
      profileLimit: 10,
      entityLimit: 8,
    },
    owner,
  );
}

function buildChannelResponseBlock(request: AgentRunRequest): string {
  if (request.policy.responseFormat !== 'plain_text') return '';

  return '\n\n<channel_response_format>\n'
    + 'IMPORTANT: You are replying in a plain-text channel. '
    + 'Do not use markdown syntax, code fences, tables, or HTML. '
    + 'Keep formatting minimal and use plain sentences or simple bullet points only.\n'
    + '</channel_response_format>';
}

function looksLikeInternalToolSyntax(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed) return false;

  return (
    /^print\s*\(/i.test(trimmed) ||
    /default_api\./i.test(trimmed) ||
    /^tool[_\s-]?call[:(]/i.test(trimmed) ||
    /^function[_\s-]?call[:(]/i.test(trimmed)
  );
}

const THAI_DIAGNOSIS_HEADINGS = [
  'ปัญหาที่น่าจะเป็น:',
  'ความมั่นใจ:',
  'ระดับความรุนแรง:',
  'ควรทำทันที:',
  'ป้องกันรอบต่อไป:',
  'ควรติดต่อเจ้าหน้าที่ส่งเสริมเมื่อไร:',
];

const ENGLISH_DIAGNOSIS_HEADINGS = [
  'Likely issue:',
  'Confidence:',
  'Severity:',
  'Immediate action:',
  'Prevention:',
  'When to contact an extension officer:',
];

async function rewriteDiagnosisIntoContract(input: {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  draftText: string;
  strictThaiOnly?: boolean;
}): Promise<string> {
  const preferThai = isThaiText(input.userPrompt);
  const headings = preferThai
    ? THAI_DIAGNOSIS_HEADINGS.join('\n')
    : ENGLISH_DIAGNOSIS_HEADINGS.join('\n');
  const extraLanguageRule = input.strictThaiOnly
    ? '\nFor Thai answers, avoid English common names, Latin scientific names, English chemical names, and English text in parentheses. Use Thai descriptions only.'
    : '';

  const rewrite = await generateText({
    model: input.modelId,
    system: `${input.systemPrompt}

Rewrite the draft into the required diagnosis contract.
Keep the same language as the user.
Use plain text only.
Do not ask for province or location unless weather is explicitly needed.
${extraLanguageRule}
Use these exact headings:
${headings}`,
    messages: await convertToModelMessages([
      {
        role: 'user',
        parts: [{ type: 'text', text: input.userPrompt }],
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: input.draftText }],
      },
    ] as Parameters<typeof convertToModelMessages>[0]),
  });

  return rewrite.text.trim();
}


export async function prepareCanonicalAgentImageGeneration(input: {
  prompt: string;
  activeBrand?: Brand | null;
  referenceImageUrls?: string[];
  source: 'chat' | 'agent' | 'shared_link' | 'line';
}): Promise<PreparedAgentImageRun> {
  const activeBrand = input.activeBrand ?? null;
  const canonicalBrandImageContext = activeBrand
    ? await buildBrandImageContext(activeBrand.id)
    : { referenceImageUrls: [], logoUrl: null };

  const prompt = activeBrand
    ? `${input.prompt}${buildImageBrandSuffix(activeBrand)}`
    : input.prompt;

  const hasExplicitReferences = (input.referenceImageUrls?.length ?? 0) > 0;
  const baseImageUrls = hasExplicitReferences
    ? input.referenceImageUrls ?? []
    : canonicalBrandImageContext.referenceImageUrls;
  const logoUrl = canonicalBrandImageContext.logoUrl;
  const imageUrls =
    baseImageUrls.length > 0 || logoUrl
      ? [...baseImageUrls, ...(logoUrl ? [logoUrl] : [])]
      : undefined;

  const taskHint = inferChatImageTaskHint({
    prompt,
    hasImages: Boolean(imageUrls?.length),
    hasActiveBrand: Boolean(activeBrand),
  });
  const selection = await resolveAdminImageModel({ taskHint });

  return {
    prompt,
    modelId: selection.modelId,
    creditCost: getCreditCost(selection.modelId),
    ...(selection.enablePro !== undefined ? { enablePro: selection.enablePro } : {}),
    ...(taskHint ? { taskHint } : {}),
    ...(imageUrls?.length ? { imageUrls } : {}),
    source: input.source,
  };
}

export async function startCanonicalAgentImageGeneration(input: {
  prompt: string;
  userId: string;
  threadId?: string;
  activeBrand?: Brand | null;
  referenceImageUrls?: string[];
  source: 'chat' | 'agent' | 'shared_link' | 'line';
}): Promise<AgentRunImageStartedResult> {
  const prepared = await prepareCanonicalAgentImageGeneration({
    prompt: input.prompt,
    activeBrand: input.activeBrand,
    referenceImageUrls: input.referenceImageUrls,
    source: input.source,
  });

  const { taskId, generationId } = await triggerImageGeneration(
    {
      prompt: prepared.prompt,
      modelId: prepared.modelId,
      promptTitle: prepared.prompt.substring(0, 50),
      ...(prepared.enablePro !== undefined ? { enablePro: prepared.enablePro } : {}),
      ...(prepared.taskHint ? { taskHint: prepared.taskHint } : {}),
      ...(prepared.imageUrls?.length ? { imageUrls: prepared.imageUrls } : {}),
    },
    input.userId,
    {
      threadId: input.threadId,
      source: prepared.source,
      referenceImageUrls: prepared.imageUrls,
    },
  );

  return {
    type: 'image_started',
    prompt: prepared.prompt,
    taskId,
    generationId,
    modelId: prepared.modelId,
    creditCost: prepared.creditCost,
  };
}

export async function prepareAgentRun(request: AgentRunRequest): Promise<PreparedAgentRun> {
  const channelContext = getChannelContext(request);
  const [agentRows, memoryContextOverride] = await Promise.all([
    channelContext.agentOverride !== undefined
      ? Promise.resolve(channelContext.agentOverride ? [channelContext.agentOverride] : [])
      : request.agentId
        ? db.select().from(agent).where(eq(agent.id, request.agentId)).limit(1)
        : Promise.resolve([]),
    channelContext.memoryContext !== undefined
      ? Promise.resolve(channelContext.memoryContext)
      : request.policy.allowMemoryRead && request.identity.userId
        ? getUserMemoryContext(request.identity.userId)
        : Promise.resolve(''),
  ]);

  const resolvedAgent = (agentRows[0] ?? null) as Agent | null;
  const lastUserPrompt = getLastUserPromptFromRunMessages(request.messages);
  const [resolvedSkillRuntime, brandRuntime, resolvedDomainContext] = await Promise.all([
    channelContext.skillRuntimeOverride !== undefined
      ? Promise.resolve(channelContext.skillRuntimeOverride)
      : resolveAgentSkillRuntime(resolvedAgent, lastUserPrompt),
    resolveAgentBrandRuntime({
      userId: request.identity.billingUserId,
      activeBrandId: request.activeBrandId ?? null,
      agent: resolvedAgent,
      enabled: true,
    }),
    channelContext.domainContextBlock !== undefined
      ? Promise.resolve(null)
      : resolveDomainPromptContext({
          request,
          lineChannelId: channelContext.lineChannelId,
          userMessage: lastUserPrompt,
        }),
  ]);
  const skillRuntime = resolvedSkillRuntime ?? EMPTY_SKILL_RUNTIME;
  const { brandResolution, activeBrand } = brandRuntime;
  const resolvedDomainContextBlock = channelContext.domainContextBlock
    ?? renderDomainContextPromptBlock(resolvedDomainContext);
  const resolvedDomainSetupBlock = channelContext.domainSetupBlock
    ?? buildDomainSetupPromptBlock({
      userMessage: lastUserPrompt,
      context: resolvedDomainContext,
      skillRuntime,
    });

  if (brandResolution?.shouldBlock) {
    throw new Error(brandResolution.blockMessage ?? 'This agent requires a valid brand before it can run.');
  }

  const effectiveDocumentIds = mergeAgentDocumentIds({
    agentDocumentIds: resolvedAgent?.documentIds,
    selectedDocumentIds: request.selectedDocumentIds,
  });
  const baseToolIds = channelContext.baseToolIds ?? resolvedAgent?.enabledTools ?? null;
  const activeToolIds = mergeAgentToolIds({
    baseToolIds,
    skillRuntime,
  });

  const enabledIds =
    request.enabledModelIds?.length
      ? request.enabledModelIds.filter((id) => availableModels.some((model) => model.id === id))
      : availableModels.map((model) => model.id);

  const manualModel = request.model && request.model !== 'auto' ? request.model : null;
  const manualResolved = manualModel && enabledIds.includes(manualModel) ? manualModel : null;
  const agentAutoModel =
    (!request.model || request.model === 'auto') &&
    resolvedAgent?.modelId &&
    enabledIds.includes(resolvedAgent.modelId)
      ? resolvedAgent.modelId
      : null;

  const estimatedContextTokens =
    request.messages.reduce((sum, message) => {
      const partsLength = message.parts ? JSON.stringify(message.parts).length : 0;
      return sum + Math.ceil((message.content.length + partsLength) / 4);
    }, 0) +
    Math.ceil(
      (skillRuntime.activeSkillsBlock.length +
        skillRuntime.skillResourcesBlock.length +
        skillRuntime.catalogBlock.length) / 4,
    ) +
    3000;

  const routedModel = manualResolved
    ? { modelId: manualResolved, reason: 'Manual selection' }
    : agentAutoModel
      ? { modelId: agentAutoModel, reason: 'Agent default model' }
      : getModelByIntent({
          prompt: lastUserPrompt,
          enabledModelIds: enabledIds.length > 0 ? enabledIds : [chatModel],
          useWebSearch: request.useWebSearch,
          userScores: channelContext.userScores ?? new Map<string, number>(),
          hasAgent: Boolean(resolvedAgent),
          hasActiveSkills: skillRuntime.activatedSkills.length > 0,
          messageCount: request.messages.length,
          estimatedContextTokens,
        });

  const modelId = routedModel.modelId;
  const supportsTools = request.policy.allowTools && !toolDisabledModels.has(modelId);
  const baseSystemPrompt = channelContext.baseSystemPromptOverride
    ?? resolveAgentBaseSystemPrompt({ agent: resolvedAgent });
  const memoryContext = memoryContextOverride ?? '';
  const systemPrompt = buildAgentRunSystemPrompt({
    base: baseSystemPrompt,
    conversationSummaryBlock: channelContext.conversationSummaryBlock ?? '',
    threadWorkingMemoryBlock: channelContext.threadWorkingMemoryBlock ?? '',
    isGrounded: Boolean(effectiveDocumentIds?.length),
    activeBrand,
    memoryContext,
    sharedMemoryBlock: channelContext.sharedMemoryBlock ?? '',
    domainContextBlock: resolvedDomainContextBlock,
    domainSetupBlock: resolvedDomainSetupBlock,
    skillRuntime: skillRuntime ?? EMPTY_SKILL_RUNTIME,
    examPrepBlock: channelContext.examPrepBlock ?? '',
    certBlock: channelContext.certBlock ?? '',
    quizContextBlock: supportsTools ? (channelContext.quizContextBlock ?? '') : '',
    brandPromptInstruction: brandResolution?.promptInstruction,
    extraBlocks: [...(channelContext.extraBlocks ?? []), buildChannelResponseBlock(request)],
  });

  let tools: ToolSet | undefined;
  if (supportsTools) {
    const builtInTools = channelContext.toolsOverride
      ?? (
        resolvedAgent
          ? createAgentTools(
              activeToolIds,
              request.identity.billingUserId,
              effectiveDocumentIds,
              {
                threadId: request.threadId,
                referenceImageUrls: channelContext.referenceImageUrls,
                brandId: activeBrand?.id,
              },
            )
          : buildToolSet({
              enabledToolIds: activeToolIds,
              userId: request.identity.billingUserId,
              brandId: activeBrand?.id,
              documentIds: effectiveDocumentIds,
              rerankEnabled: channelContext.rerankEnabled ?? false,
              source: 'agent',
              threadId: request.threadId,
              referenceImageUrls: channelContext.referenceImageUrls,
            })
      );
    const customTools = channelContext.toolsOverride || !resolvedAgent
      ? {}
      : await buildUserCreatedToolSet({
          userId: request.identity.billingUserId,
          agentId: resolvedAgent.id,
          source: request.identity.channel === 'line' ? 'line' : 'agent',
          threadId: request.threadId,
        });
    tools = { ...builtInTools, ...customTools };

    if (!channelContext.toolsOverride && request.policy.allowMcp && resolvedAgent?.mcpServers?.length) {
      const mcpTools = await buildMCPToolSet(
        resolvedAgent.mcpServers,
        channelContext.mcpCredentials ?? {},
      ).catch((error: unknown) => {
        console.error('[MCP] Tool build failed:', error);
        return {};
      });
      tools = { ...tools, ...mcpTools };
    }
  }

  return {
    request,
    agent: resolvedAgent,
    lastUserPrompt,
    activeBrand,
    effectiveDocumentIds,
    activeToolIds,
    supportsTools,
    modelId,
    routingReason: routedModel.reason,
    creditCost: getCreditCost(modelId),
    systemPrompt,
    memoryContext,
    skillRuntime,
    ...(tools ? { tools } : {}),
  };
}

export async function runAgentText(prepared: PreparedAgentRun): Promise<AgentRunTextResult> {
  const lastUserPrompt = prepared.lastUserPrompt ?? '';
  const preferThai = isThaiText(lastUserPrompt);
  const directFarmSummaryRequest = inferFarmRecordSummaryRequest(lastUserPrompt);
  const workflowCapabilities = await listResponseWorkflowCapabilities({
    actorUserId: prepared.request.identity.userId,
    brandId: prepared.activeBrand?.id ?? null,
    isOwner: prepared.request.identity.isOwner,
  });

  if (directFarmSummaryRequest) {
    const { runSummarizeRecords } = await import('@/features/record-keeper/service');
    const summaryPayload = await runSummarizeRecords(
      {
        contextType: directFarmSummaryRequest.contextType,
        period: directFarmSummaryRequest.period,
      },
      prepared.request.identity.billingUserId,
    );
    const stableSummary = formatFarmRecordSummary(summaryPayload, preferThai);

    if (stableSummary) {
      return {
        type: 'text',
        text: stableSummary,
        toolCallCount: 0,
        imageUrls: [],
        responsePlan: buildResponsePlan({
          text: stableSummary,
          userText: lastUserPrompt,
          locale: preferThai ? 'th-TH' : 'en-US',
          workflowContext: {
            actorCapabilities: workflowCapabilities,
            scopeType: prepared.activeBrand?.id ? 'brand' : 'user',
            scopeId: prepared.activeBrand?.id ?? prepared.request.identity.userId ?? prepared.request.identity.lineUserId ?? prepared.request.identity.billingUserId,
            sourceThreadId: prepared.request.threadId,
            channel: prepared.request.identity.channel === 'line' ? 'line' : 'web',
          },
          metadata: {
            source: 'direct_record_summary',
          },
        }),
        modelId: prepared.modelId,
        creditCost: prepared.creditCost,
      };
    }
  }

  const result = await generateText({
    model: prepared.modelId,
    system: prepared.systemPrompt,
    messages: await convertToModelMessages(
      buildAgentRunModelMessages(prepared.request.messages) as Parameters<typeof convertToModelMessages>[0],
    ),
    stopWhen: stepCountIs(prepared.request.policy.maxSteps),
    ...(prepared.supportsTools && prepared.tools ? { tools: prepared.tools } : {}),
  });

  let resolvedText = result.text;

  if (looksLikeRecordSummaryRequest(lastUserPrompt)) {
    const summaryPayload = extractNamedToolPayload(result.toolResults, ['summarize_activity_records']);
    const stableSummary = formatFarmRecordSummary(summaryPayload, preferThai);

    if (stableSummary) {
      resolvedText = stableSummary;
    }
  }

  if (!resolvedText.trim() && (result.toolResults?.length ?? 0) > 0) {
    const fallbackToolContext = buildToolResultsFallbackContext(result.toolResults);

    if (fallbackToolContext) {
      const fallbackResult = await generateText({
        model: prepared.modelId,
        system: `${prepared.systemPrompt}

You have already used tools for this request. The previous assistant turn produced tool results but no final user-facing answer.
Write the final plain-language answer now using the tool results below.
Do not call tools again. Do not mention internal tool mechanics unless necessary for transparency.`,
        messages: await convertToModelMessages([
          ...buildAgentRunModelMessages(prepared.request.messages),
          {
            role: 'assistant',
            parts: [
              {
                type: 'text',
                text: `Tool results available:\n\n${fallbackToolContext}`,
              },
            ],
          },
        ] as Parameters<typeof convertToModelMessages>[0]),
      });

      if (fallbackResult.text.trim()) {
        resolvedText = fallbackResult.text;
      }
    }
  }

  if (!resolvedText.trim() || looksLikeInternalToolSyntax(resolvedText)) {
    const finalPassMessages = buildAgentRunModelMessages(prepared.request.messages);
    const lastAttemptWasToolSyntax = looksLikeInternalToolSyntax(resolvedText);

    if (lastAttemptWasToolSyntax && resolvedText.trim()) {
      finalPassMessages.push({
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: `Discard this internal draft and rewrite it as a user-facing answer:\n${resolvedText}`,
          },
        ],
      });
    }

    const finalPass = await generateText({
      model: prepared.modelId,
      system: `${prepared.systemPrompt}

Provide a direct final answer to the user's latest message now.
Do not call tools.
Do not output code, function names, JSON, XML, or tool call syntax such as default_api.* or print(...).
Return only the user-facing answer in the same language as the user.
If information is missing, say so briefly and ask one short follow-up question.`,
      messages: await convertToModelMessages(
        finalPassMessages as Parameters<typeof convertToModelMessages>[0],
      ),
    });

    if (finalPass.text.trim()) {
      resolvedText = finalPass.text;
    }
  }

  if (looksLikeInternalToolSyntax(resolvedText)) {
    const rewriteResult = await generateText({
      model: prepared.modelId,
      system: `${prepared.systemPrompt}

Rewrite the assistant draft into a normal user-facing answer.
Do not call tools.
Do not output code, function names, JSON, XML, or tool call syntax.
Keep the answer in the same language as the user and preserve any required response headings.`,
      messages: await convertToModelMessages([
        ...buildAgentRunModelMessages(prepared.request.messages),
        {
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: `Rewrite this draft for the user:\n${resolvedText}`,
            },
          ],
        },
      ] as Parameters<typeof convertToModelMessages>[0]),
    });

    if (rewriteResult.text.trim() && !looksLikeInternalToolSyntax(rewriteResult.text)) {
      resolvedText = rewriteResult.text;
    }
  }

  if (looksLikeRecordSummaryRequest(lastUserPrompt)) {
    const summaryPayload = extractNamedToolPayload(result.toolResults, ['summarize_activity_records']);
    const stableSummary = formatFarmRecordSummary(summaryPayload, preferThai);

    if (stableSummary) {
      resolvedText = stableSummary;
    }
  }

  if (looksLikeDiagnosisRequest(lastUserPrompt)) {
    const requiredHeadings = preferThai ? THAI_DIAGNOSIS_HEADINGS : ENGLISH_DIAGNOSIS_HEADINGS;

    if (!hasRequiredHeadings(resolvedText, requiredHeadings)) {
      const rewrittenDiagnosis = await rewriteDiagnosisIntoContract({
        modelId: prepared.modelId,
        systemPrompt: prepared.systemPrompt,
        userPrompt: lastUserPrompt,
        draftText: resolvedText,
      });

      if (rewrittenDiagnosis && hasRequiredHeadings(rewrittenDiagnosis, requiredHeadings)) {
        resolvedText = rewrittenDiagnosis;
      } else if (preferThai || !resolvedText.trim() || !isThaiText(resolvedText)) {
        resolvedText = buildFallbackDiagnosisContract(lastUserPrompt, preferThai);
      }
    }

    if (preferThai && containsLikelyUnexpectedEnglish(resolvedText)) {
      const thaiOnlyDiagnosis = await rewriteDiagnosisIntoContract({
        modelId: prepared.modelId,
        systemPrompt: prepared.systemPrompt,
        userPrompt: lastUserPrompt,
        draftText: resolvedText,
        strictThaiOnly: true,
      });

      if (
        thaiOnlyDiagnosis &&
        hasRequiredHeadings(thaiOnlyDiagnosis, requiredHeadings) &&
        !containsLikelyUnexpectedEnglish(thaiOnlyDiagnosis)
      ) {
        resolvedText = thaiOnlyDiagnosis;
      }
    }
  }

  return {
    type: 'text',
    text: resolvedText,
    toolCallCount: result.toolResults?.length ?? 0,
    imageUrls: collectToolImageUrls(result.toolResults),
    responsePlan: buildResponsePlan({
      text: resolvedText,
      userText: lastUserPrompt,
      locale: preferThai ? 'th-TH' : 'en-US',
      toolResults: result.toolResults,
      workflowContext: {
        actorCapabilities: workflowCapabilities,
        scopeType: prepared.activeBrand?.id ? 'brand' : 'user',
        scopeId: prepared.activeBrand?.id ?? prepared.request.identity.userId ?? prepared.request.identity.lineUserId ?? prepared.request.identity.billingUserId,
        sourceThreadId: prepared.request.threadId,
        channel: prepared.request.identity.channel === 'line' ? 'line' : 'web',
      },
      metadata: {
        modelId: prepared.modelId,
      },
    }),
    modelId: prepared.modelId,
    creditCost: prepared.creditCost,
  };
}

export async function startAgentImageRun(prepared: PreparedAgentRun): Promise<AgentRunImageStartedResult> {
  if (!prepared.lastUserPrompt) {
    throw new Error('Image generation requires a text prompt.');
  }

  return startCanonicalAgentImageGeneration({
    prompt: prepared.lastUserPrompt,
    userId: prepared.request.identity.billingUserId,
    threadId: prepared.request.threadId,
    activeBrand: prepared.activeBrand,
    referenceImageUrls: getChannelContext(prepared.request).referenceImageUrls,
    source:
      prepared.request.identity.channel === 'web'
        ? 'chat'
        : prepared.request.identity.channel === 'shared_link'
          ? 'shared_link'
          : 'line',
  });
}

export async function runAgent(request: AgentRunRequest): Promise<AgentRunResult> {
  const prepared = await prepareAgentRun(request);

  if (
    request.policy.allowDirectImageGeneration &&
    prepared.lastUserPrompt &&
    wantsImageGeneration(prepared.lastUserPrompt)
  ) {
    return startAgentImageRun(prepared);
  }

  return runAgentText(prepared);
}
