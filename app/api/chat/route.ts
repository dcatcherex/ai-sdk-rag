import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  stepCountIs,
} from 'ai';
import { headers } from 'next/headers';
import { and, count, eq, exists, isNull, or } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { agent, agentShare, chatThread, user as userTable, userPreferences } from '@/db/schema';
import { availableModels, chatModel, maxSteps, isStrongModel } from '@/lib/ai';
import { getSystemPrompt, resolveSystemPromptTemplate } from '@/lib/prompt';
import { enhancePrompt } from '@/lib/prompt-enhance';
import { summarizeConversation, SUMMARY_THRESHOLD } from '@/lib/conversation-summary';
import { getUserModelScores } from '@/lib/model-scores';
import { getUserMemoryContext, extractAndStoreMemory } from '@/lib/memory';
import { generateFollowUpSuggestions } from '@/lib/follow-up-suggestions';
import { buildToolSet } from '@/lib/tools';
import { createAgentTools } from '@/lib/agent-tools';
import { buildMCPToolSet } from '@/lib/tools/mcp';
import { getCreditCost, getUserBalance } from '@/lib/credits';
import { parseGuestCookie, getGuestSessionById, deductGuestCredits } from '@/lib/guest-access';
import { requestSchema } from '@/features/chat/server/schema';
import { buildBrandImageContext, buildImageBrandSuffix } from '@/features/brands/service';
import { assembleSystemPrompt } from '@/features/chat/server/prompt-assembly';
import type { Brand } from '@/features/brands/types';
import {
  buildBrandMemoryPromptBlock,
  buildThreadWorkingMemoryPromptBlock,
  refreshThreadWorkingMemoryFromMessages,
} from '@/features/memory/service';
import {
  getSkillsForAgent,
  resolveSkillRuntimeContext,
} from '@/features/skills/service';
import { getWorkspaceContext } from '@/features/platform-agent/service';
import { buildPlatformAgentSystemPrompt } from '@/features/platform-agent/prompts';
import { getPlatformAgentTools } from '@/features/platform-agent/agent';
import type { Agent } from '@/features/agents/types';
import { resolveEffectiveBrand } from '@/features/agents/server/brand-resolution';
import type { Skill } from '@/features/skills/types';
import { getLastUserPrompt } from '@/features/chat/server/thread-utils';
import { toolDisabledModels, isImageOnlyModel, getModelByIntent } from '@/features/chat/server/routing';
import { triggerImageGeneration } from '@/features/image/service';
import { buildReferencePreviewItems } from '@/features/image/reference-previews';
import {
  ensureConfiguredStarterAgentForUser,
  getConfiguredGuestStarterAgent,
} from '@/features/agents/server/starter';
import { persistChatResult } from '@/features/chat/server/persistence';
import {
  buildChatRunInputSummary,
  buildChatRunOutputSummary,
  completeChatRunError,
  completeChatRunSuccess,
  getFollowUpSuggestionCount,
  getToolCallCount,
  startChatRun,
  updateChatRunRouting,
} from '@/features/chat/audit/audit';
import type { ChatMessage, ChatMessageMetadata, RoutingMetadata } from '@/features/chat/types';
import {
  getImageAttachmentParts,
  getLatestAssistantImageParts,
  isFreshImageRegenerationRequest,
  isImplicitImageEditRequest,
  mapToKieImageModel,
} from '@/features/chat/server/image-context';
import { hydrateIncomingChatMessages } from '@/features/chat/server/message-hydration';
import { isImageFilePart, uploadImagePart } from '@/features/chat/server/image-upload';

export { type ChatMessage };
export const maxDuration = 30;

export async function POST(req: Request) {
  let chatRunId: string | null = null;
  let chatRunRouteKind: 'text' | 'image' = 'text';
  let chatRunResolvedModelId: string | null = null;

  try {
    // ── Stage 1: auth + body parse in parallel ───────────────────────────────
    const [sessionUser, rawBody, requestHeaders] = await Promise.all([
      getCurrentUser(),
      req.json(),
      headers(),
    ]);
    const session = sessionUser ? { user: sessionUser } : null;

    // Guest session fallback when unauthenticated
    let guestSessionId: string | null = null;
    let guestBalance = 0;
    if (!session?.user) {
      const cookieHeader = requestHeaders.get('cookie');
      const guestId = parseGuestCookie(cookieHeader);
      if (guestId) {
        const gs = await getGuestSessionById(guestId);
        if (gs) { guestSessionId = gs.id; guestBalance = gs.credits; }
      }
      if (!guestSessionId) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const isGuest = !session?.user;
    const effectiveUserId = session?.user?.id ?? '';

    const { messages, threadId, model, useWebSearch, selectedDocumentIds, enabledModelIds, agentId, brandId, quizContext } =
      requestSchema.parse(rawBody);
    const hydratedMessages = await hydrateIncomingChatMessages(messages, effectiveUserId);

    // ── Eager image upload (authenticated users only) ────────────────────────
    const latestUserMsgIdx = hydratedMessages.map((m) => m.role).lastIndexOf('user');
    let eagerUploadedMessages = hydratedMessages;
    if (!isGuest && latestUserMsgIdx !== -1) {
      const latestUserMsg = hydratedMessages[latestUserMsgIdx]!;
      const eagerMsgId = latestUserMsg.id ?? `eager-${Date.now()}`;
      const eagerPartResults = await Promise.all(
        (latestUserMsg.parts ?? []).map(async (part, index) => {
          if (!isImageFilePart(part as Parameters<typeof isImageFilePart>[0])) return { part };
          return uploadImagePart({
            part: part as Parameters<typeof uploadImagePart>[0]['part'],
            threadId,
            messageId: eagerMsgId,
            index,
            userId: effectiveUserId,
          });
        }),
      );
      const hasUploads = eagerPartResults.some((r) => r.asset);
      if (hasUploads) {
        eagerUploadedMessages = hydratedMessages.map((m, i) =>
          i === latestUserMsgIdx
            ? { ...m, id: eagerMsgId, parts: eagerPartResults.map((r) => r.part) }
            : m,
        );
        console.log('[IMG-URL-TRACE] eager upload done', eagerPartResults.flatMap((r) => r.asset ? [r.asset.url] : []));
      }
    }

    // ── Stage 2: all independent DB queries in parallel ──────────────────────
    const [userRow, threadRows, prefsRows, balance, activeAgentRows] = await Promise.all([
      isGuest
        ? Promise.resolve([{ approved: true }])
        : db.select({ approved: userTable.approved }).from(userTable).where(eq(userTable.id, effectiveUserId)).limit(1),
      isGuest
        ? db.select({ id: chatThread.id, title: chatThread.title }).from(chatThread).where(and(eq(chatThread.id, threadId), eq(chatThread.guestSessionId, guestSessionId!))).limit(1)
        : db.select({ id: chatThread.id, title: chatThread.title }).from(chatThread).where(and(eq(chatThread.id, threadId), eq(chatThread.userId, effectiveUserId))).limit(1),
      isGuest
        ? Promise.resolve([])
        : db.select().from(userPreferences).where(eq(userPreferences.userId, effectiveUserId)).limit(1),
      isGuest
        ? Promise.resolve(guestBalance)
        : getUserBalance(effectiveUserId),
      (!isGuest && agentId)
        ? db
            .select()
            .from(agent)
            .where(
              and(
                eq(agent.id, agentId),
                or(
                  eq(agent.userId, effectiveUserId),
                  eq(agent.isPublic, true),
                  and(
                    isNull(agent.userId),
                    eq(agent.managedByAdmin, true),
                    eq(agent.catalogStatus, 'published'),
                  ),
                  exists(
                    db
                      .select({ id: agentShare.agentId })
                      .from(agentShare)
                      .where(
                        and(
                          eq(agentShare.agentId, agentId),
                          eq(agentShare.sharedWithUserId, effectiveUserId),
                        ),
                      ),
                  ),
                ),
              ),
            )
            .limit(1)
        : Promise.resolve([]),
    ]);

    if (!isGuest && !userRow[0]?.approved) {
      return Response.json(
        { error: 'Your account is pending approval. Please contact the admin.' },
        { status: 403 }
      );
    }
    if (threadRows.length === 0) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const currentTitle = threadRows[0]!.title ?? 'New chat';
    const userPrefs = prefsRows[0] ?? { memoryEnabled: true, memoryInjectEnabled: true, memoryExtractEnabled: true, promptEnhancementEnabled: true, followUpSuggestionsEnabled: true, enabledToolIds: null, rerankEnabled: false };
    let activeAgent: (typeof activeAgentRows)[number] | Agent | null = activeAgentRows[0] ?? null;
    let requiresConfiguredStarterTemplate = false;
    if (!activeAgent) {
      if (isGuest) {
        const starterAgent = await getConfiguredGuestStarterAgent();
        if (starterAgent) {
          activeAgent = starterAgent;
        }
      } else if (!agentId) {
        const starterAgent = await ensureConfiguredStarterAgentForUser(effectiveUserId);
        if (starterAgent) {
          activeAgent = starterAgent;
        } else {
          const agentCountRows = await db
            .select({ count: count() })
            .from(agent)
            .where(eq(agent.userId, effectiveUserId));
          requiresConfiguredStarterTemplate = (agentCountRows[0]?.count ?? 0) === 0;
        }
      }
    }
    if (requiresConfiguredStarterTemplate) {
      return Response.json(
        { error: 'A starter template must be configured before first-time users can chat. Ask an admin to update Platform Settings.' },
        { status: 409 },
      );
    }

    // ── Platform agent detection (authenticated users only) ──────────────────
    const isVajaPlatformRequest = !isGuest && agentId === 'vaja-platform';
    const isPlatformAgentActive = isVajaPlatformRequest;
    const lastUserPrompt = getLastUserPrompt(messages);

    // Load skills attached to the active agent
    const agentSkillRows: Skill[] =
      activeAgent
        ? await getSkillsForAgent(activeAgent.id)
        : [];
    const skillRuntime = agentSkillRows.length > 0 && lastUserPrompt
      ? await resolveSkillRuntimeContext(agentSkillRows, lastUserPrompt)
      : {
          catalogBlock: '',
          activatedSkills: [],
          activeSkillsBlock: '',
          skillResourcesBlock: '',
          skillToolIds: [],
        };

    // ── Stage 3: memory + brand (authenticated users only) ───────────────────
    const [memoryContext, brandResolution] = await Promise.all([
      (!isGuest && userPrefs.memoryEnabled && userPrefs.memoryInjectEnabled)
        ? getUserMemoryContext(effectiveUserId)
        : Promise.resolve(''),
      !isGuest
        ? resolveEffectiveBrand({
            userId: effectiveUserId,
            activeBrandId: brandId,
            agent: activeAgent,
          })
        : Promise.resolve(null),
    ]);

    if (brandResolution?.shouldBlock) {
      return Response.json(
        { error: brandResolution.blockMessage ?? 'This agent requires a valid brand before it can run.' },
        { status: 409 },
      );
    }

    const activeBrand = (brandResolution?.effectiveBrand ?? null) as Brand | null;
    const [threadWorkingMemoryBlock, sharedMemoryBlock] = await Promise.all([
      isGuest ? Promise.resolve('') : buildThreadWorkingMemoryPromptBlock(threadId),
      isGuest ? Promise.resolve('') : buildBrandMemoryPromptBlock(effectiveUserId, activeBrand?.id ?? null, lastUserPrompt ?? ''),
    ]);

    // Merge agent pre-associated docs + user-selected docs (union, deduplicated)
    const agentDocIds = activeAgent?.documentIds ?? [];
    const userDocIds = selectedDocumentIds ?? [];
    const effectiveDocIds =
      agentDocIds.length > 0 || userDocIds.length > 0
        ? [...new Set([...agentDocIds, ...userDocIds])]
        : undefined;

    const isGrounded = !!effectiveDocIds?.length;

    // Determine which tool group IDs are active for this request:
    //   1. Agent has its own explicit list (overrides everything)
    //   2. Otherwise use the user's saved preferences (null = all tools)
    const baseToolIds = activeAgent
      ? activeAgent.enabledTools
      : (userPrefs.enabledToolIds ?? null);
    // Merge in tool IDs unlocked by triggered skills (deduplicated)
    const activeToolIds = skillRuntime.skillToolIds.length > 0
      ? [...new Set([...(baseToolIds ?? []), ...skillRuntime.skillToolIds])]
      : baseToolIds;

    const examPrepToolEnabled = activeToolIds === null || activeToolIds.includes('exam_prep');
    const certificateToolEnabled = activeToolIds === null || activeToolIds.includes('certificate');

    // Base system prompt: platform agent > agent > default
    let baseSystemPrompt: string;
    if (isPlatformAgentActive) {
      const workspaceCtx = await getWorkspaceContext(effectiveUserId);
      baseSystemPrompt = buildPlatformAgentSystemPrompt(workspaceCtx);
    } else {
      const rawSystemPrompt = activeAgent ? activeAgent.systemPrompt : getSystemPrompt();
      baseSystemPrompt = resolveSystemPromptTemplate(rawSystemPrompt);
    }


    // ── Model routing ────────────────────────────────────────────────────────
    const enabledIds =
      enabledModelIds?.length
        ? enabledModelIds.filter((id) => availableModels.some((m) => m.id === id))
        : availableModels.map((m) => m.id);

    const agentSuggestedModel = activeAgent?.modelId ?? null;
    const agentAutoModel =
      (!model || model === 'auto') && agentSuggestedModel && availableModels.some((entry) => entry.id === agentSuggestedModel)
        ? agentSuggestedModel
        : null;
    const guestFallbackModel = !model || model === 'auto' ? chatModel : null;
    const manualModel = model && model !== 'auto' ? model : null;
    const manualResolved = manualModel && enabledIds.includes(manualModel) ? manualModel : null;

    const userScores = (manualResolved || isGuest)
      ? new Map<string, number>()
      : await getUserModelScores(effectiveUserId);

    // Rough token estimate: message history + injected skill content + system prompt overhead.
    // Used by the router to exclude models whose context window is too small.
    const estimatedContextTokens =
      messages.reduce((sum, m) => sum + Math.ceil(JSON.stringify(m.parts ?? []).length / 4), 0) +
      Math.ceil(
        (skillRuntime.activeSkillsBlock.length +
          skillRuntime.skillResourcesBlock.length +
          skillRuntime.catalogBlock.length) / 4
      ) +
      3000; // system prompt + memory + tool definitions overhead

    const routingDecision = manualResolved
      ? { modelId: manualResolved, reason: 'Manual selection' }
      : agentAutoModel
        ? { modelId: agentAutoModel, reason: 'Agent default model' }
        : getModelByIntent({
            prompt: lastUserPrompt,
            enabledModelIds: enabledIds.length > 0 ? enabledIds : [guestFallbackModel ?? availableModels[0]!.id],
            useWebSearch,
            userScores,
            hasAgent: !!activeAgent,
            hasActiveSkills: skillRuntime.activatedSkills.length > 0,
            messageCount: messages.length,
            estimatedContextTokens,
          });

    const resolvedModel = routingDecision.modelId;
    const routingMetadata: RoutingMetadata = {
      mode: manualResolved ? 'manual' : 'auto',
      modelId: resolvedModel,
      reason: routingDecision.reason,
    };
    chatRunRouteKind = isImageOnlyModel(resolvedModel) ? 'image' : 'text';
    chatRunResolvedModelId = resolvedModel;

    // chatRun audit skipped for guests (chatRun requires a real userId FK)
    let currentChatRunId = '';
    if (!isGuest) {
      currentChatRunId = await startChatRun({
        userId: effectiveUserId,
        threadId,
        agentId: activeAgent?.id ?? null,
        brandId: activeBrand?.id ?? null,
        requestedModelId: model ?? agentSuggestedModel ?? null,
        useWebSearch,
        inputJson: buildChatRunInputSummary({
          messages,
          requestedModelId: model ?? agentSuggestedModel ?? null,
          useWebSearch,
          selectedDocumentIds: effectiveDocIds,
          enabledModelIds,
          agentId: activeAgent?.id ?? null,
          brandId: activeBrand?.id ?? null,
          quizContext,
          activeToolIds,
          activeSkillIds: skillRuntime.activatedSkills.map((entry) => entry.skill.id),
          lastUserPrompt,
        }),
      });
      chatRunId = currentChatRunId;

      await updateChatRunRouting(currentChatRunId, {
        routeKind: chatRunRouteKind,
        resolvedModelId: resolvedModel,
        routing: routingMetadata,
      });
    }

    // ── Credit check ─────────────────────────────────────────────────────────
    const creditCost = getCreditCost(resolvedModel);
    if (balance < creditCost) {
      if (currentChatRunId) {
        await completeChatRunError(currentChatRunId, {
          errorMessage: `Insufficient credits for ${resolvedModel}`,
          routeKind: chatRunRouteKind,
          resolvedModelId: resolvedModel,
        });
      }
      return Response.json(
        {
          error: `Insufficient credits. This model costs ${creditCost} credits, but you have ${balance}. Please contact admin for more credits.`,
        },
        { status: 402 }
      );
    }

    const supportsTools = !toolDisabledModels.has(resolvedModel);

    // Inject tool guidance only when the message is relevant to that tool domain.
    // This avoids spending ~200 tokens of system prompt on every unrelated message.
    const examRelevant = !!quizContext || /quiz|exam|practice|study|flashcard|flash card|grade|diagnos|learning gap|weak area|revision|ทบทวน|ข้อสอบ|แบบฝึกหัด/i.test(lastUserPrompt ?? '');
    const examPrepToolInstructions = supportsTools && examPrepToolEnabled && examRelevant
      ? '\nIMPORTANT: When the user asks to be quizzed, wants practice questions, asks you to grade an answer, wants a study plan, asks you to diagnose weak areas or misconceptions, or asks for flashcards or memorization cards, you MUST call the exam prep tools directly. Do NOT pretend to grade or generate a quiz freehand when the exam prep tools are available. If selected documents are attached to the chat, the exam prep tools already ground themselves in those documents automatically, so use the relevant exam prep tool directly unless you need extra document exploration beyond the tool result. Use generate_practice_quiz for quizzes and mock questions, grade_practice_answer for scoring or feedback on an answer, create_study_plan for revision schedules and topic prioritization, analyze_learning_gaps for weakness diagnosis, misconceptions, and what to study next, and generate_flashcards for revision cards and recall practice. If an exam prep tool call fails, explain the real issue briefly and ask only for the missing information.'
      : '';

    const certRelevant = /certif|template|recipient|generate cert|preview cert|ใบรับรอง|ใบประกาศ|ใบวุฒิ/i.test(lastUserPrompt ?? '');
    const certificateBrandHint = activeBrand
      ? (() => {
          const hints: string[] = [`The user's active brand is "${activeBrand.name}".`];
          const primaryColor = activeBrand.colors.find((c) => c.label.toLowerCase() === 'primary') ?? activeBrand.colors[0];
          if (primaryColor?.hex) hints.push(`Primary brand color: ${primaryColor.hex}.`);
          if (activeBrand.fonts.length) hints.push(`Brand fonts: ${activeBrand.fonts.join(', ')}.`);
          return ` ${hints.join(' ')} Prefer these values when filling certificate fields unless the user specifies otherwise.`;
        })()
      : '';
    const certificateToolInstructions = supportsTools && certificateToolEnabled && certRelevant
      ? `\nIMPORTANT: When the user wants to create, preview, or inspect certificate templates or certificate outputs, you MUST call the certificate tools directly. Do NOT describe tool calls, do NOT print JSON action blocks, and do NOT say you are about to call a tool. If you need template information, call list_certificate_templates. If you need to validate inputs, call preview_certificate_generation. If you need to create the output, call generate_certificate_output or generate_certificate. If a certificate tool call fails, explain the actual tool error briefly and ask the user only for the missing information or corrective action. Do NOT fabricate a generic technical issue message and do NOT emit another pseudo tool-call block as text.${certificateBrandHint}`
      : '';
    const quizContextBlock = quizContext
      ? `\n\n<interactive_quiz_context>
Latest quiz state from the client UI:
- Quiz message ID: ${quizContext.messageId}
- Questions completed: ${quizContext.answeredCount}/${quizContext.questionCount}
- Objective questions scored: ${quizContext.correctCount}/${quizContext.objectiveAnsweredCount}
- Quiz completed: ${quizContext.completed ? 'yes' : 'no'}
${quizContext.attempts.length > 0 ? `- Attempts:\n${quizContext.attempts.map((attempt, index) => [
  `${index + 1}. ${attempt.question}`,
  `   Topic: ${attempt.topic}`,
  `   Type: ${attempt.type}`,
  `   User answer: ${attempt.userAnswer || '(blank)'}`,
  `   Correct answer: ${attempt.correctAnswer}`,
  `   Revealed: ${attempt.wasRevealed ? 'yes' : 'no'}`,
  `   Result: ${attempt.isCorrect === null ? 'not auto-graded' : attempt.isCorrect ? 'correct' : 'incorrect'}`,
].join('\n')).join('\n')}` : ''}
</interactive_quiz_context>

IMPORTANT: This quiz context reflects the learner's actual progress in the interactive quiz UI. If the user asks what to do next, what they got wrong, what to review, or asks for a diagnosis after completing the quiz, rely on this context instead of claiming the quiz is unfinished. If the quiz is completed and the user asks for next-step guidance, prefer using analyze_learning_gaps with the completed attempts when exam prep tools are available.`
      : '';
    // ── Prompt enhancement ───────────────────────────────────────────────────
    let enhancedPrompt: string | undefined;
    let messagesToSend = eagerUploadedMessages;
    if (userPrefs.promptEnhancementEnabled && lastUserPrompt && !isStrongModel(resolvedModel)) {
      const enhanced = await enhancePrompt(lastUserPrompt, memoryContext);
      if (enhanced !== lastUserPrompt) {
        enhancedPrompt = enhanced;
        const lastUserIdx = eagerUploadedMessages.map((m) => m.role).lastIndexOf('user');
        if (lastUserIdx !== -1) {
          messagesToSend = eagerUploadedMessages.map((m, i) =>
            i !== lastUserIdx
              ? m
              : { ...m, parts: m.parts.map((p) => (p.type === 'text' ? { ...p, text: enhanced } : p)) }
          );
        }
      }
    }

    // ── Conversation summarisation ───────────────────────────────────────────
    let conversationSummaryBlock = '';
    if (messages.length > SUMMARY_THRESHOLD) {
      const { summary, trimmedMessages } = await summarizeConversation(messagesToSend as ChatMessage[]);
      if (summary) {
        conversationSummaryBlock = `\n\n<conversation_summary>\nSummary of earlier conversation:\n${summary}\n</conversation_summary>`;
        messagesToSend = trimmedMessages;
      }
    }

    // ── System prompt assembly ───────────────────────────────────────────────

    // DEBUG: trace image URL sources — full scan across all messages
    const _dbgAllFileParts = messagesToSend.flatMap(m =>
      (m.parts ?? [])
        .filter(p => (p as {type?:string}).type === 'file')
        .map(p => ({ role: m.role, url: (p as {url?:string}).url?.substring(0, 100) }))
    );
    const _dbgToolParts = messagesToSend.flatMap(m =>
      (m.parts ?? [])
        .filter(p => (p as {type?:string}).type?.startsWith('tool-') && (p as {toolName?:string}).toolName === 'generate_image')
        .map(p => {
          const part = p as {type?:string; input?:Record<string,unknown>; output?:Record<string,unknown>};
          const inputUrls = (part.input?.imageUrls as string[] | undefined) ?? [];
          const out = part.output ?? {};
          const outputUrls = (out.imageUrls as string[] | undefined) ?? (out.imageUrl ? [out.imageUrl as string] : []);
          return { type: part.type, inputUrls: inputUrls.map((u:string) => u.substring(0,100)), outputUrls: outputUrls.map((u:string) => u.substring(0,100)) };
        })
    );
    console.log('[IMG-URL-TRACE] ALL file parts across messages:', JSON.stringify(_dbgAllFileParts));
    console.log('[IMG-URL-TRACE] generate_image tool parts (input+output):', JSON.stringify(_dbgToolParts));

    const latestAssistantImageParts = getLatestAssistantImageParts(messagesToSend);
    const latestUserMessage = [...messagesToSend].reverse().find((message) => message.role === 'user');
    const latestUserImageParts = getImageAttachmentParts(latestUserMessage);
    const wantsFreshImageRegeneration = isFreshImageRegenerationRequest(lastUserPrompt);
    const shouldAutoReuseLastImage =
      latestAssistantImageParts.length > 0 &&
      latestUserImageParts.length === 0 &&
      isImplicitImageEditRequest(lastUserPrompt) &&
      !wantsFreshImageRegeneration;
    const effectiveReferenceImageParts = latestUserImageParts.length > 0
      ? latestUserImageParts
      : shouldAutoReuseLastImage
        ? latestAssistantImageParts
        : [];

    console.log('[IMG-URL-TRACE] latestAssistantImageParts:', JSON.stringify(latestAssistantImageParts.map(p => p.url)));
    console.log('[IMG-URL-TRACE] threadWorkingMemoryBlock snippet:', threadWorkingMemoryBlock.substring(0, 400));
    console.log('[IMG-URL-TRACE] sharedMemoryBlock snippet:', sharedMemoryBlock.substring(0, 200));
    console.log('[IMG-URL-TRACE] memoryContext snippet:', memoryContext.substring(0, 600));

    const latestImageToolBlock =
      supportsTools && latestAssistantImageParts.length > 0
        ? `\n\n<latest_generated_images>
The most recent assistant-generated image(s) in this thread:
${latestAssistantImageParts.map((part, index) => `${index + 1}. ${part.url}`).join('\n')}
</latest_generated_images>

IMPORTANT: If the user asks to edit, modify, change, add to, remove from, or continue from the most recently generated image without attaching a new image, treat the image above as the reference image automatically. When calling the \`generate_image\` tool for that kind of follow-up, include these URL(s) in \`imageUrls\` instead of generating from scratch.`
        : '';
    const freshImageRegenerationBlock =
      supportsTools
        ? `\n\nIMPORTANT: If the user asks for another version, a new theme, a new style, a different layout, a fresh variation, or says things like "ขอแบบใหม่", "ขออีกภาพ", or "เปลี่ยนธีม", do NOT automatically reuse the most recently generated image as an edit reference unless they explicitly say to keep/edit the same image. Treat those requests as fresh generation requests instead.`
        : '';

    const userAttachedImageUrls = latestUserImageParts
      .map((p) => p.url)
      .filter((u) => u.startsWith('http'));
    const userAttachedImagesBlock =
      supportsTools && userAttachedImageUrls.length > 0
        ? `\n\n<user_attached_images>
The user has attached the following image(s) to their current message:
${userAttachedImageUrls.map((url, index) => `${index + 1}. ${url}`).join('\n')}
</user_attached_images>

IMPORTANT: These are the exact URL(s) the user attached. If they want to generate, edit, or transform an image based on these attachments, you MUST include these URL(s) in the \`imageUrls\` parameter when calling \`generate_image\`. Do not omit \`imageUrls\` when the user has attached images.`
        : '';

    const effectiveSystemPrompt = assembleSystemPrompt({
      base: baseSystemPrompt,
      conversationSummaryBlock,
      threadWorkingMemoryBlock,
      isGrounded,
      activeBrand,
      memoryContext,
      sharedMemoryBlock,
      skillRuntime,
      examPrepBlock: examPrepToolInstructions,
      certBlock: certificateToolInstructions,
      quizContextBlock: supportsTools ? quizContextBlock : '',
    })
      + (brandResolution?.promptInstruction
        ? `\n\n<brand_resolution>\n${brandResolution.promptInstruction}\n</brand_resolution>`
        : '')
      + latestImageToolBlock
      + freshImageRegenerationBlock
      + userAttachedImagesBlock;

    // When platform agent is active, expose platform management tools exclusively.
    // Platform tools must not bleed into regular agent or user tool sets.
    const baseTools = isPlatformAgentActive
      ? getPlatformAgentTools({ userId: effectiveUserId })
      : activeAgent
        ? (isGuest
            ? {}
            : createAgentTools(activeToolIds, effectiveUserId, effectiveDocIds, {
                threadId,
                referenceImageUrls: effectiveReferenceImageParts.map((part) => part.url),
                brandId: activeBrand?.id,
              }))
        : (isGuest
            ? {}
            : buildToolSet({
                enabledToolIds: activeToolIds,
                userId: effectiveUserId,
                brandId: activeBrand?.id,
                documentIds: isGrounded ? effectiveDocIds : undefined,
                rerankEnabled: userPrefs.rerankEnabled ?? false,
                source: 'agent',
                threadId,
                referenceImageUrls: effectiveReferenceImageParts.map((part) => part.url),
              }));

    // Merge MCP tools from agent config (empty object when no MCP servers configured)
    const mcpTools = !isGuest && activeAgent?.mcpServers?.length
      ? await buildMCPToolSet(
          activeAgent.mcpServers,
          (userPrefs as { mcpCredentials?: Record<string, string> }).mcpCredentials ?? {},
        ).catch((err: unknown) => {
          console.error('[MCP] Tool build failed:', err);
          return {};
        })
      : {};

    const groundedTools = { ...baseTools, ...mcpTools };
    const activeTools = supportsTools ? groundedTools : undefined;

    const messageMetadata = (): ChatMessageMetadata => ({
      routing: routingMetadata,
      ...(enhancedPrompt ? { enhancedPrompt } : {}),
    });

    // ── Async KIE image generation path ─────────────────────────────────────
    if (isImageOnlyModel(resolvedModel)) {
      const baseImagePrompt = enhancedPrompt ?? lastUserPrompt;
      if (!baseImagePrompt) {
        if (currentChatRunId) {
          await completeChatRunError(currentChatRunId, {
            errorMessage: 'Image generation requires a text prompt.',
            routeKind: 'image',
            resolvedModelId: resolvedModel,
          });
        }
        return Response.json({ error: 'Image generation requires a text prompt.' }, { status: 400 });
      }

      const canonicalBrandImageContext = activeBrand
        ? await buildBrandImageContext(activeBrand.id)
        : { referenceImageUrls: [], logoUrl: null };

      const imagePrompt = activeBrand
        ? baseImagePrompt + buildImageBrandSuffix(activeBrand)
        : baseImagePrompt;

      const hasImages = effectiveReferenceImageParts.length > 0;
      const baseImageUrls = hasImages
        ? effectiveReferenceImageParts.map((p) => p.url)
        : canonicalBrandImageContext.referenceImageUrls.length > 0
          ? canonicalBrandImageContext.referenceImageUrls
          : [];
      // Logo appended last — model receives it as a brand mark reference, not a composition element
      const logoUrl = canonicalBrandImageContext.logoUrl;
      const imageUrls =
        baseImageUrls.length > 0 || logoUrl
          ? [...baseImageUrls, ...(logoUrl ? [logoUrl] : [])]
          : undefined;
      const { kieModelId, enablePro, taskHint } = await mapToKieImageModel(resolvedModel, {
        hasImages: Boolean(imageUrls?.length),
        prompt: imagePrompt,
        hasActiveBrand: Boolean(activeBrand),
      });

      const { taskId, generationId } = await triggerImageGeneration(
        {
          prompt: imagePrompt,
          modelId: kieModelId,
          promptTitle: imagePrompt.substring(0, 50),
          ...(imageUrls ? { imageUrls } : {}),
          ...(taskHint ? { taskHint } : {}),
          ...(enablePro !== undefined ? { enablePro } : {}),
        },
        effectiveUserId,
        { threadId, source: 'chat', referenceImageUrls: imageUrls },
      );

      const toolCallId = crypto.randomUUID();
      const toolInput = { prompt: imagePrompt, modelId: kieModelId };
      const toolOutput = {
        started: true,
        status: 'processing' as const,
        taskId,
        generationId,
        startedAt: new Date().toISOString(),
        ...(imageUrls?.length
          ? { referenceImages: buildReferencePreviewItems(imageUrls, { lastIsLogo: Boolean(logoUrl) }) }
          : {}),
        message: 'Image generation started. The image will appear in this chat when it is ready.',
      };

      return createUIMessageStreamResponse({
        stream: createUIMessageStream<ChatMessage>({
          originalMessages: messages,
          onFinish: async ({ messages: updatedMessages }) => {
            try {
              await persistChatResult({
                updatedMessages,
                threadId,
                userId: isGuest ? null : effectiveUserId,
                guestSessionId: isGuest ? guestSessionId : null,
                currentTitle,
                resolvedModel,
                creditCost,
                brandId: activeBrand?.id ?? null,
                tokenUsageData: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
              });

              if (currentChatRunId) await completeChatRunSuccess(currentChatRunId, {
                routeKind: 'image',
                resolvedModelId: resolvedModel,
                creditCost,
                toolCallCount: 1,
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                outputJson: buildChatRunOutputSummary({
                  routeKind: 'image',
                  generatedImage: { mediaType: 'image/kie-async' },
                  memoryExtracted: false,
                }),
              });
            } catch (error) {
              console.error('Failed to finalize async image chat run:', error);
              if (currentChatRunId) {
                await completeChatRunError(currentChatRunId, {
                  errorMessage: error instanceof Error ? error.message : 'Unknown finalization error',
                  routeKind: 'image',
                  resolvedModelId: resolvedModel,
                }).catch((auditError) => console.error('Failed to mark image chat run as error:', auditError));
              }
            }
          },
          execute: ({ writer }) => {
            writer.write({ type: 'start', messageMetadata: messageMetadata() });
            writer.write({ type: 'start-step' });
            writer.write({
              type: 'tool-input-available',
              toolCallId,
              toolName: 'generate_image',
              input: toolInput,
            });
            writer.write({
              type: 'tool-output-available',
              toolCallId,
              output: toolOutput,
            });
            writer.write({ type: 'finish-step' });
            writer.write({ type: 'finish', finishReason: 'stop' });
          },
        }),
      });
    }

    // ── Text streaming path ──────────────────────────────────────────────────
    // Strip compare assistant messages from LLM context
    const messagesForLLM = messagesToSend.filter((m) => {
      if (m.role !== 'assistant') return true;
      return !(m.metadata as ChatMessageMetadata | undefined)?.compareGroupId;
    });

    const autonomyLevel = (activeAgent?.structuredBehavior as { autonomyLevel?: number } | null)?.autonomyLevel ?? 2;

    const result = streamText({
      model: resolvedModel,
      system: effectiveSystemPrompt,
      messages: await convertToModelMessages(messagesForLLM),
      stopWhen: stepCountIs(maxSteps),
      ...(supportsTools ? { tools: activeTools } : {}),
      experimental_context: { autonomyLevel, userId: effectiveUserId || null },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      messageMetadata,
      onFinish: async ({ messages: updatedMessages }) => {
        try {
          const usage = (await result.usage) as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
          const typedMessages = updatedMessages as ChatMessage[];

          // Inject follow-up suggestions into last assistant message
          const lastAssistantIdx = typedMessages.map((m) => m.role).lastIndexOf('assistant');
          let messagesWithSuggestions = typedMessages;
          if (lastAssistantIdx !== -1 && (userPrefs.followUpSuggestionsEnabled ?? true)) {
            const contextStr = typedMessages
              .slice(-6)
              .map((m) => {
                const textPart = m.parts.find((p) => p.type === 'text');
                const text = textPart?.type === 'text' ? textPart.text.slice(0, 400) : '';
                return `${m.role}: ${text}`;
              })
              .filter((line) => !line.endsWith(': '))
              .join('\n');

            const suggestions = await generateFollowUpSuggestions(contextStr);
            if (suggestions.length > 0) {
              messagesWithSuggestions = typedMessages.map((m, i) =>
                i === lastAssistantIdx
                  ? { ...m, metadata: { ...m.metadata, followUpSuggestions: suggestions } }
                  : m
              );
            }
          }

          await persistChatResult({
            updatedMessages: messagesWithSuggestions,
            threadId,
            userId: isGuest ? null : effectiveUserId,
            guestSessionId: isGuest ? guestSessionId : null,
            currentTitle,
            resolvedModel,
            creditCost,
            brandId: activeBrand?.id ?? null,
            tokenUsageData: usage,
          });

          if (!isGuest) {
            await refreshThreadWorkingMemoryFromMessages({
              threadId,
              brandId: activeBrand?.id ?? null,
              messages: messagesWithSuggestions as Array<{
                id?: string;
                role: string;
                parts?: Array<{ type?: string; text?: string }>;
              }>,
            }).catch((error) => console.error('Failed to refresh thread working memory:', error));

            const shouldExtractMemory = userPrefs.memoryEnabled && userPrefs.memoryExtractEnabled;
            if (shouldExtractMemory) {
              void extractAndStoreMemory(
                effectiveUserId,
                messagesWithSuggestions as Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>,
                threadId,
                memoryContext
              );
            }

            const toolCallCount = getToolCallCount(messagesWithSuggestions);
            if (currentChatRunId) {
              await completeChatRunSuccess(currentChatRunId, {
                routeKind: 'text',
                resolvedModelId: resolvedModel,
                creditCost,
                toolCallCount,
                promptTokens: usage?.promptTokens,
                completionTokens: usage?.completionTokens,
                totalTokens: usage?.totalTokens,
                outputJson: buildChatRunOutputSummary({
                  routeKind: 'text',
                  messages: messagesWithSuggestions,
                  followUpSuggestionCount: getFollowUpSuggestionCount(messagesWithSuggestions),
                  memoryExtracted: shouldExtractMemory,
                }),
              });
            }
          }
        } catch (error) {
          console.error('Failed to finalize chat run:', error);
          if (currentChatRunId) {
            await completeChatRunError(currentChatRunId, {
              errorMessage: error instanceof Error ? error.message : 'Unknown finalization error',
              routeKind: 'text',
              resolvedModelId: resolvedModel,
            }).catch((auditError) => console.error('Failed to mark chat run as error:', auditError));
          }
        }
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (chatRunId) {
      await completeChatRunError(chatRunId, {
        errorMessage: message,
        routeKind: chatRunRouteKind,
        resolvedModelId: chatRunResolvedModelId,
      }).catch((auditError) => console.error('Failed to mark chat run as error:', auditError));
    }
    return Response.json({ error: message }, { status: 400 });
  }
}
