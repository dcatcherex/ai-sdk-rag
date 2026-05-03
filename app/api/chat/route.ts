import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  stepCountIs,
} from 'ai';
import { headers } from 'next/headers';
import { count, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { agent } from '@/db/schema';
import { checkUserApproved, getThreadForSession, getUserPrefs } from '@/features/chat/server/queries';
import { getAgentForUser } from '@/features/agents/server/queries';
import { getUserModelScores } from '@/lib/model-scores';
import { getUserMemoryContext } from '@/lib/memory';
import { getUserBalance } from '@/lib/credits';
import { deductGuestCredits } from '@/lib/guest-access';
import { requestSchema } from '@/features/chat/server/schema';
import { WEB_AGENT_RUN_POLICY } from '@/features/agents/server/channel-policies';
import { buildBrandMemoryPromptBlock } from '@/features/memory/server/brand-memory';
import { buildThreadWorkingMemoryPromptBlock } from '@/features/memory/server/working-memory';
import {
  resolveAgentBrandRuntime,
  resolveAgentSkillRuntime,
} from '@/features/agents/server/runtime';
import { getWorkspaceContext } from '@/features/platform-agent/service';
import { buildPlatformAgentSystemPrompt } from '@/features/platform-agent/prompts';
import { getPlatformAgentTools } from '@/features/platform-agent/agent';
import { prepareAgentRun, startCanonicalAgentImageGeneration } from '@/features/agents/server/run-service';
import type { Agent } from '@/features/agents/types';
import { getLastUserPrompt } from '@/features/chat/server/thread-utils';
import { isImageOnlyModel } from '@/features/chat/server/routing';
import { buildReferencePreviewItems } from '@/features/image/reference-previews';
import {
  buildChatRunInputSummary,
  completeChatRunError,
  startChatRun,
  updateChatRunRouting,
} from '@/features/chat/audit/audit';
import type { ChatMessage, ChatMessageMetadata, RoutingMetadata } from '@/features/chat/types';
import { finalizeImageChatTurn, finalizeTextChatTurn } from '@/features/chat/server/finalization';
import { hydrateIncomingChatMessages } from '@/features/chat/server/message-hydration';
import { isImageFilePart, uploadImagePart } from '@/features/chat/server/image-upload';
import { resolveWebChatIdentity } from '@/features/chat/server/web-chat-identity';
import { resolveWebActiveAgent } from '@/features/chat/server/web-active-agent';
import {
  buildQuizContextBlock,
  buildWebChannelContext,
  resolveConversationSummary,
  resolvePromptEnhancement,
} from '@/features/chat/server/web-channel-context';
import { buildImageChannelContext } from '@/features/chat/server/web-image-channel-context';

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
    let identity;
    try {
      identity = await resolveWebChatIdentity({
        sessionUser,
        cookieHeader: requestHeaders.get('cookie'),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      throw error;
    }

    const { isGuest, effectiveUserId, guestSessionId, guestBalance } = identity;

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
      }
    }

    // ── Stage 2: all independent DB queries in parallel ──────────────────────
    const baseAgentRunMessages = eagerUploadedMessages.map((message) => {
      const textPart = message.parts.find((part) => part.type === 'text');
      return {
        role: message.role,
        content: textPart?.type === 'text' ? textPart.text : '',
        parts: message.parts,
      };
    });

    const [userApproved, thread, prefs, balance, activeAgentRow] = await Promise.all([
      isGuest ? Promise.resolve(true) : checkUserApproved(effectiveUserId),
      getThreadForSession({ threadId, userId: isGuest ? null : effectiveUserId, guestSessionId }),
      isGuest ? Promise.resolve(null) : getUserPrefs(effectiveUserId),
      isGuest ? Promise.resolve(guestBalance) : getUserBalance(effectiveUserId),
      (!isGuest && agentId) ? getAgentForUser(agentId, effectiveUserId) : Promise.resolve(null),
    ]);

    if (!isGuest && !userApproved) {
      return Response.json(
        { error: 'Your account is pending approval. Please contact the admin.' },
        { status: 403 }
      );
    }
    if (!thread) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const currentTitle = thread.title ?? 'New chat';
    const userPrefs = prefs ?? { memoryEnabled: true, memoryInjectEnabled: true, memoryExtractEnabled: true, promptEnhancementEnabled: true, followUpSuggestionsEnabled: true, enabledToolIds: null, rerankEnabled: false };
    const resolvedActiveAgent = await resolveWebActiveAgent({
      isGuest,
      requestedAgentId: agentId,
      effectiveUserId,
      activeAgentRow,
    });
    let activeAgent: Agent | null = resolvedActiveAgent.activeAgent;
    const { requiresConfiguredStarterTemplate } = resolvedActiveAgent;
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

    const skillRuntime = await resolveAgentSkillRuntime(activeAgent, lastUserPrompt);

    // ── Stage 3: memory + brand (authenticated users only) ───────────────────
    const [memoryContext, brandRuntime] = await Promise.all([
      (!isGuest && userPrefs.memoryEnabled && userPrefs.memoryInjectEnabled)
        ? getUserMemoryContext(effectiveUserId)
        : Promise.resolve(''),
      resolveAgentBrandRuntime({
        userId: effectiveUserId,
        activeBrandId: brandId,
        agent: activeAgent,
        enabled: !isGuest,
      }),
    ]);
    const { brandResolution, activeBrand } = brandRuntime;

    if (brandResolution?.shouldBlock) {
      return Response.json(
        { error: brandResolution.blockMessage ?? 'This agent requires a valid brand before it can run.' },
        { status: 409 },
      );
    }

    const [threadWorkingMemoryBlock, sharedMemoryBlock] = await Promise.all([
      isGuest ? Promise.resolve('') : buildThreadWorkingMemoryPromptBlock(threadId),
      isGuest ? Promise.resolve('') : buildBrandMemoryPromptBlock(effectiveUserId, activeBrand?.id ?? null, lastUserPrompt ?? ''),
    ]);

    // Determine which tool group IDs are active for this request:
    //   1. Agent has its own explicit list (overrides everything)
    //   2. Otherwise use the user's saved preferences (null = all tools)
    const baseToolIds = activeAgent
      ? activeAgent.enabledTools
      : (userPrefs.enabledToolIds ?? null);

    // Base system prompt: platform agent > agent > default
    let baseSystemPrompt: string;
    if (isPlatformAgentActive) {
      const workspaceCtx = await getWorkspaceContext(effectiveUserId);
      baseSystemPrompt = buildPlatformAgentSystemPrompt(workspaceCtx);
    } else {
      baseSystemPrompt = activeAgent?.systemPrompt ?? '';
    }


    // ── Model routing ────────────────────────────────────────────────────────
    const manualModelSelected = Boolean(model && model !== 'auto');
    const userScores = (manualModelSelected || isGuest)
      ? new Map<string, number>()
      : await getUserModelScores(effectiveUserId);

    const quizContextBlock = buildQuizContextBlock({ quizContext });
    // ── Prompt enhancement ───────────────────────────────────────────────────
    const promptEnhancement = await resolvePromptEnhancement({
      enabled: userPrefs.promptEnhancementEnabled ?? true,
      lastUserPrompt,
      memoryContext,
      messages: eagerUploadedMessages,
    });
    const enhancedPrompt = promptEnhancement.enhancedPrompt;
    let messagesToSend = promptEnhancement.messagesToSend;

    // ── Conversation summarisation ───────────────────────────────────────────
    const conversationSummary = await resolveConversationSummary({
      messages: messagesToSend as ChatMessage[],
    });
    const conversationSummaryBlock = conversationSummary.conversationSummaryBlock;
    messagesToSend = conversationSummary.messagesToSend;

    // ── System prompt assembly ───────────────────────────────────────────────

    const { effectiveReferenceImageParts, imageBlocks } = buildImageChannelContext({
      messages: messagesToSend,
      lastUserPrompt,
    });

    const toolsOverride = isPlatformAgentActive
      ? getPlatformAgentTools({ userId: effectiveUserId })
      : isGuest
        ? {}
        : undefined;
    const channelContext = buildWebChannelContext({
      memoryContext,
      sharedMemoryBlock,
      threadWorkingMemoryBlock,
      conversationSummaryBlock,
      quizContextBlock,
      imageBlocks,
      rerankEnabled: userPrefs.rerankEnabled ?? false,
      referenceImageUrls: effectiveReferenceImageParts.map((part) => part.url),
      mcpCredentials: (userPrefs as { mcpCredentials?: Record<string, string> }).mcpCredentials ?? {},
      baseToolIds,
      activeAgent,
      baseSystemPromptOverride: isPlatformAgentActive ? baseSystemPrompt : undefined,
      userScores,
      toolsOverride,
      skillRuntime,
    });

    const preparedRun = await prepareAgentRun({
      identity: {
        channel: 'web',
        userId: isGuest ? null : effectiveUserId,
        billingUserId: effectiveUserId,
        guestId: guestSessionId,
      },
      threadId,
      agentId: activeAgent?.id ?? null,
      activeBrandId: brandId,
      selectedDocumentIds,
      messages: baseAgentRunMessages,
      model: model ?? null,
      enabledModelIds,
      useWebSearch,
      policy: WEB_AGENT_RUN_POLICY,
      channelContext,
    });

    const resolvedModel = preparedRun.modelId;
    const routingMetadata: RoutingMetadata = {
      mode: manualModelSelected ? 'manual' : 'auto',
      modelId: resolvedModel,
      reason: preparedRun.routingReason,
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
        requestedModelId: model ?? activeAgent?.modelId ?? null,
        useWebSearch,
        inputJson: buildChatRunInputSummary({
          messages,
          requestedModelId: model ?? activeAgent?.modelId ?? null,
          useWebSearch,
          selectedDocumentIds: preparedRun.effectiveDocumentIds,
          enabledModelIds,
          agentId: activeAgent?.id ?? null,
          brandId: activeBrand?.id ?? null,
          quizContext,
          activeToolIds: preparedRun.activeToolIds,
          activeSkillIds: preparedRun.skillRuntime.activatedSkills.map((entry) => entry.skill.id),
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
    const creditCost = preparedRun.creditCost;
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

    const effectiveSystemPrompt = preparedRun.systemPrompt;
    const activeTools = preparedRun.tools;

    const finishCtx = {
      threadId,
      userId: isGuest ? null : effectiveUserId,
      guestSessionId: isGuest ? guestSessionId : null,
      currentTitle,
      resolvedModel,
      creditCost,
      brandId: activeBrand?.id ?? null,
      currentChatRunId,
      followUpSuggestionsEnabled: userPrefs.followUpSuggestionsEnabled ?? true,
      memoryEnabled: userPrefs.memoryEnabled ?? true,
      memoryExtractEnabled: userPrefs.memoryExtractEnabled ?? true,
      memoryContext,
      lastUserPrompt,
    };

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

      const imageRun = await startCanonicalAgentImageGeneration({
        prompt: baseImagePrompt,
        userId: effectiveUserId,
        threadId,
        activeBrand,
        referenceImageUrls: effectiveReferenceImageParts.map((part) => part.url),
        source: 'chat',
      });

      const toolCallId = crypto.randomUUID();
      const toolInput = { prompt: imageRun.prompt, modelId: imageRun.modelId };
      const toolOutput = {
        started: true,
        status: 'processing' as const,
        taskId: imageRun.taskId,
        generationId: imageRun.generationId,
        startedAt: new Date().toISOString(),
        ...(effectiveReferenceImageParts.length > 0
          ? { referenceImages: buildReferencePreviewItems(effectiveReferenceImageParts.map((part) => part.url)) }
          : {}),
        message: 'Image generation started. The image will appear in this chat when it is ready.',
      };

      return createUIMessageStreamResponse({
        stream: createUIMessageStream<ChatMessage>({
          originalMessages: messages,
          onFinish: async ({ messages: updatedMessages }) => {
            await finalizeImageChatTurn({
              updatedMessages,
              finishCtx,
              toolMessage: toolOutput.message,
            });
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
      stopWhen: stepCountIs(preparedRun.request.policy.maxSteps),
      ...(preparedRun.supportsTools ? { tools: activeTools } : {}),
      experimental_context: { autonomyLevel, userId: effectiveUserId || null },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      messageMetadata,
      onFinish: async ({ messages: updatedMessages }) => {
        const usage = (await result.usage) as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
        await finalizeTextChatTurn({
          updatedMessages: updatedMessages as ChatMessage[],
          usage,
          finishCtx,
        });
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
