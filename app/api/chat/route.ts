import {
  streamText,
  generateImage,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIDataTypes,
  type UIMessagePart,
  convertToModelMessages,
  stepCountIs,
} from 'ai';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import type { SystemPromptKey } from '@/lib/prompt';
import { availableModels, type Capability, chatModel, maxSteps } from '@/lib/ai';
import { env } from '@/lib/env';
import { getSystemPrompt, detectSystemPromptKey } from '@/lib/prompt';
import { enhancePrompt } from '@/lib/prompt-enhance';
import { summarizeConversation, SUMMARY_THRESHOLD } from '@/lib/conversation-summary';
import { getUserModelScores, type ModelScoreMap } from '@/lib/model-scores';
import { getUserMemoryContext, extractAndStoreMemory } from '@/lib/memory';
import { generateFollowUpSuggestions } from '@/lib/follow-up-suggestions';
import { baseTools, type ChatTools } from '@/lib/tools';
import { createScopedRagTools } from '@/lib/rag-tool';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatMessage, chatThread, mediaAsset, tokenUsage, userPreferences, agent } from '@/db/schema';
import { createAgentTools } from '@/lib/agent-tools';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { uploadPublicObject } from '@/lib/r2';
import { getCreditCost, getUserBalance, deductCredits } from '@/lib/credits';

export const maxDuration = 30;

type RoutingMetadata = {
  mode: 'auto' | 'manual';
  modelId: string;
  reason: string;
};

type ChatMessageMetadata = {
  routing?: RoutingMetadata;
  persona?: SystemPromptKey;
  enhancedPrompt?: string;
};

export type ChatMessage = UIMessage<ChatMessageMetadata, UIDataTypes, ChatTools>;

type ImageFilePart = {
  type: 'file';
  mediaType: string;
  url: string;
  filename?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  assetId?: string;
  parentAssetId?: string;
  rootAssetId?: string;
  version?: number;
  editPrompt?: string;
};

type MediaAssetInsert = typeof mediaAsset.$inferInsert;

type UploadPartResult = {
  part: UIMessagePart<UIDataTypes, ChatTools> | ImageFilePart;
  asset?: MediaAssetInsert;
};

const isImageFilePart = (
  part: UIMessagePart<UIDataTypes, ChatTools>
): part is ImageFilePart => {
  if (part.type !== 'file') {
    return false;
  }
  const record = part as Record<string, unknown>;
  return (
    typeof record.mediaType === 'string' &&
    typeof record.url === 'string' &&
    record.mediaType.startsWith('image/')
  );
};

const parseDataUrl = (url: string) => {
  const match = /^data:([^;]+);base64,(.+)$/.exec(url);
  if (!match) {
    return null;
  }

  return {
    mediaType: match[1],
    data: Buffer.from(match[2], 'base64'),
  };
};

const uploadImagePart = async (options: {
  part: ImageFilePart;
  threadId: string;
  messageId: string;
  index: number;
  userId: string;
}): Promise<UploadPartResult> => {
  const { part, threadId, messageId, index, userId } = options;
  const dataUrl = parseDataUrl(part.url);
  if (!dataUrl) {
    return { part };
  }

  try {
    const image = sharp(dataUrl.data);
    const metadata = await image.metadata();
    const webpBuffer = await image.webp({ quality: 80 }).toBuffer();
    const thumbnailBuffer = await sharp(dataUrl.data)
      .resize({ width: 320, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
    const width = metadata.width ?? 1024;
    const height = metadata.height ?? 1024;
    const baseKey = [
      'chat-images',
      threadId,
      messageId,
      `${index + 1}-${nanoid(6)}`,
    ].join('/');
    const fullKey = `${baseKey}.webp`;
    const thumbKey = `${baseKey}-thumb.webp`;
    const assetId = nanoid();

    const [fullUpload, thumbUpload] = await Promise.all([
      uploadPublicObject({
        key: fullKey,
        body: webpBuffer,
        contentType: 'image/webp',
      }),
      uploadPublicObject({
        key: thumbKey,
        body: thumbnailBuffer,
        contentType: 'image/webp',
      }),
    ]);

    const asset: MediaAssetInsert = {
      id: assetId,
      userId,
      threadId,
      messageId,
      rootAssetId: assetId,
      version: 1,
      type: 'image',
      r2Key: fullUpload.key,
      url: fullUpload.url,
      thumbnailKey: thumbUpload.key,
      thumbnailUrl: thumbUpload.url,
      mimeType: 'image/webp',
      width,
      height,
      sizeBytes: webpBuffer.byteLength,
    };

    const updatedPart: ImageFilePart = {
      ...part,
      url: fullUpload.url,
      mediaType: 'image/webp',
      filename: part.filename ?? `image-${index + 1}.webp`,
      thumbnailUrl: thumbUpload.url,
      width,
      height,
      assetId,
      rootAssetId: assetId,
      version: 1,
    };

    return {
      part: updatedPart,
      asset,
    };
  } catch (error) {
    console.error('Failed to upload image to R2:', error);
    return { part };
  }
};

const requestSchema = z.object({
  threadId: z.string().min(1),
  messages: z.array(z.custom<ChatMessage>()),
  model: z.string().optional(),
  useWebSearch: z.boolean().optional(),
  selectedDocumentIds: z.array(z.string()).optional(),
  enabledModelIds: z.array(z.string()).optional(),
  agentId: z.string().optional(),
});

const getThreadPreviewFromMessages = (messages: ChatMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const textPart = message.parts.find((part) => part.type === 'text');

    if (textPart?.type === 'text' && textPart.text.trim()) {
      return textPart.text.trim();
    }
  }
  return 'Start a conversation…';
};

const getThreadTitleFromMessages = (messages: ChatMessage[]) => {
  const userMessage = messages.find((message) => message.role === 'user');
  const textPart = userMessage?.parts.find((part) => part.type === 'text');
  if (textPart?.type !== 'text') {
    return null;
  }

  const trimmed = textPart.text.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > 64 ? `${trimmed.slice(0, 64)}…` : trimmed;
};

const getLastUserPrompt = (messages: ChatMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'user') {
      continue;
    }
    const textPart = message.parts.find((part) => part.type === 'text');
    if (textPart?.type === 'text' && textPart.text.trim()) {
      return textPart.text.trim();
    }
  }
  return null;
};

type RoutingDecision = {
  modelId: string;
  reason: string;
};

type TokenUsageSnapshot = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

const getModelByIntent = (options: {
  prompt: string | null;
  enabledModelIds: string[];
  useWebSearch?: boolean;
  userScores?: ModelScoreMap;
}): RoutingDecision => {
  const { prompt, enabledModelIds, useWebSearch, userScores } = options;
  const enabledModels = availableModels.filter((model) =>
    enabledModelIds.includes(model.id)
  );
  const safeFallback = enabledModels[0]?.id ?? chatModel;
  const fallback: RoutingDecision = {
    modelId: safeFallback,
    reason: 'Fallback to first enabled model',
  };
  if (!prompt) {
    return { modelId: safeFallback, reason: 'Empty prompt' };
  }

  const lower = prompt.toLowerCase();
  const wantsImage =
    lower.startsWith('create image') ||
    lower.startsWith('generate image') ||
    lower.includes('image of') ||
    lower.includes('draw ') ||
    lower.includes('illustration');
  const wantsWeb =
    Boolean(useWebSearch) ||
    lower.includes('search') ||
    lower.includes('latest') ||
    lower.includes('news') ||
    lower.includes('web') ||
    lower.includes('source');
  const wantsCode =
    lower.includes('code') ||
    lower.includes('coding') ||
    lower.includes('typescript') ||
    lower.includes('javascript') ||
    lower.includes('python') ||
    lower.includes('refactor') ||
    lower.includes('debug') ||
    lower.includes('implement') ||
    lower.includes('api') ||
    lower.includes('function') ||
    lower.includes('class');
  const wantsReasoning =
    lower.includes('analy') ||
    lower.includes('reason') ||
    lower.includes('compare') ||
    lower.includes('evaluate') ||
    lower.includes('diagnose') ||
    lower.includes('pros and cons') ||
    lower.includes('tradeoff');

  const pickByCapability = (capability: Capability): string | undefined => {
    const capable = enabledModels.filter((m) => (m.capabilities ?? []).some((c) => c === capability));
    if (capable.length === 0) return undefined;
    if (!userScores || userScores.size === 0) return capable[0]?.id;
    let best = capable[0]!;
    let bestScore = -Infinity;
    for (const m of capable) {
      let total = 0;
      for (const [key, val] of userScores) { if (key.startsWith(`${m.id}::`)) total += val; }
      if (total > bestScore) { bestScore = total; best = m; }
    }
    return best.id;
  };

  if (wantsImage) {
    const modelId = pickByCapability('image gen');
    return modelId
      ? { modelId, reason: 'Image generation request' }
      : { modelId: safeFallback, reason: 'Image request but no image-capable model enabled' };
  }

  if (wantsWeb) {
    const modelId = pickByCapability('web search');
    return modelId
      ? { modelId, reason: 'Web search intent' }
      : { modelId: safeFallback, reason: 'Web search intent but no web-capable model enabled' };
  }

  if (wantsCode) {
    return enabledModelIds.includes('openai/gpt-5.2')
      ? { modelId: 'openai/gpt-5.2', reason: 'Coding intent' }
      : { modelId: safeFallback, reason: 'Coding intent but GPT-5.2 not enabled' };
  }

  if (wantsReasoning) {
    return enabledModelIds.includes('anthropic/claude-opus-4.6')
      ? { modelId: 'anthropic/claude-opus-4.6', reason: 'Reasoning intent' }
      : { modelId: safeFallback, reason: 'Reasoning intent but Opus not enabled' };
  }

  // Score-biased general chat: prefer highest-scored text-capable model
  if (userScores && userScores.size > 0) {
    const textModels = enabledModels.filter((m) => (m.capabilities ?? []).some((c) => c === 'text'));
    if (textModels.length > 0) {
      let best = textModels[0]!;
      let bestScore = -Infinity;
      for (const m of textModels) {
        let total = 0;
        for (const [key, val] of userScores) { if (key.startsWith(`${m.id}::`)) total += val; }
        if (total > bestScore) { bestScore = total; best = m; }
      }
      return { modelId: best.id, reason: 'General chat (score-biased)' };
    }
  }
  return enabledModelIds.includes('google/gemini-3-flash')
    ? { modelId: 'google/gemini-3-flash', reason: 'General chat' }
    : fallback;
};

const toolDisabledModels = new Set(['google/gemini-2.5-flash-image']);

const modelSupportsCapability = (modelId: string, capability: Capability) => {
  const model = availableModels.find((option) => option.id === modelId);
  if (!model) {
    return false;
  }
  return (model.capabilities ?? []).some((modelCapability) => modelCapability === capability);
};

const isImageOnlyModel = (modelId: string) =>
  modelSupportsCapability(modelId, 'image gen') && !modelSupportsCapability(modelId, 'text');

const persistChatResult = async (options: {
  updatedMessages: ChatMessage[];
  threadId: string;
  userId: string;
  currentTitle: string;
  resolvedModel: string;
  creditCost: number;
  tokenUsageData?: TokenUsageSnapshot | null;
}) => {
  const {
    updatedMessages,
    threadId,
    userId,
    currentTitle,
    resolvedModel,
    creditCost,
    tokenUsageData,
  } = options;

  const messagesWithIds: ChatMessage[] = updatedMessages.map((message) => ({
    ...message,
    id: message.id || crypto.randomUUID(),
  }));

  const messageResults = await Promise.all(
    messagesWithIds.map(async (message) => {
      const partResults = await Promise.all(
        message.parts.map(async (part, index) => {
          if (!isImageFilePart(part)) {
            return { part };
          }

          return uploadImagePart({
            part,
            threadId,
            messageId: message.id,
            index,
            userId,
          });
        })
      );

      return {
        message: {
          ...message,
          parts: partResults.map((result) => result.part),
        },
        assets: partResults.flatMap((result) =>
          result.asset ? [result.asset] : []
        ),
      };
    })
  );

  const chatMessages = messageResults.map((result) => result.message);
  const assets = messageResults.flatMap((result) => result.assets);
  const preview = getThreadPreviewFromMessages(chatMessages);
  const nextTitle =
    currentTitle === 'New chat'
      ? getThreadTitleFromMessages(chatMessages) ?? currentTitle
      : currentTitle;

  await db
    .delete(chatMessage)
    .where(eq(chatMessage.threadId, threadId));
  if (chatMessages.length > 0) {
    await db.insert(chatMessage).values(
      chatMessages.map((message, index) => ({
        id: message.id,
        threadId,
        role: message.role,
        parts: message.parts,
        metadata: message.metadata ?? null,
        position: index,
      }))
    );
  }

  if (assets.length > 0) {
    await db.insert(mediaAsset).values(assets);
  }

  // Deduct credits after successful completion
  try {
    await deductCredits({
      userId,
      amount: creditCost,
      description: `Chat: ${resolvedModel} (thread ${threadId})`,
    });
  } catch (creditError) {
    console.error('Failed to deduct credits:', creditError);
  }

  // Track token usage after completion
  try {
    if (tokenUsageData) {
      await db.insert(tokenUsage).values({
        id: nanoid(),
        threadId,
        model: resolvedModel,
        promptTokens: tokenUsageData.promptTokens || 0,
        completionTokens: tokenUsageData.completionTokens || 0,
        totalTokens:
          tokenUsageData.totalTokens ||
          (tokenUsageData.promptTokens || 0) + (tokenUsageData.completionTokens || 0),
      });
    }
  } catch (error) {
    console.error('Failed to track token usage:', error);
  }

  await db
    .update(chatThread)
    .set({ preview, title: nextTitle, updatedAt: new Date() })
    .where(eq(chatThread.id, threadId));
};

export async function POST(req: Request) {
  env.AI_GATEWAY_API_KEY;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      messages,
      threadId,
      model,
      useWebSearch,
      selectedDocumentIds,
      enabledModelIds,
      agentId,
    } = requestSchema.parse(await req.json());

    const [threadRows, prefsRows] = await Promise.all([
      db
        .select({ id: chatThread.id, title: chatThread.title })
        .from(chatThread)
        .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)))
        .limit(1),
      db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, session.user.id))
        .limit(1),
    ]);

    const thread = threadRows;

    if (thread.length === 0) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const userPrefs = prefsRows[0] ?? { memoryEnabled: true, promptEnhancementEnabled: true };
    const lastUserPrompt = getLastUserPrompt(messages);

    // Fetch active agent if provided
    const activeAgentRows = agentId
      ? await db
          .select()
          .from(agent)
          .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
          .limit(1)
      : [];
    const activeAgent = activeAgentRows[0] ?? null;

    // Feature 3: Load memory context
    const memoryContext = userPrefs.memoryEnabled
      ? await getUserMemoryContext(session.user.id)
      : '';

    // Feature 1: Detect persona
    const detectedPersona: SystemPromptKey = lastUserPrompt
      ? detectSystemPromptKey(lastUserPrompt)
      : 'general_assistant';

    // Determine tools and system prompt based on document selection or active agent
    const isGrounded = selectedDocumentIds && selectedDocumentIds.length > 0;
    const groundedTools = activeAgent
      ? createAgentTools(activeAgent.enabledTools, selectedDocumentIds)
      : isGrounded
        ? { ...baseTools, ...createScopedRagTools(selectedDocumentIds) }
        : baseTools;
    const groundedSystemPrompt = activeAgent
      ? activeAgent.systemPrompt + (memoryContext ? `\n\n${memoryContext}` : '')
      : isGrounded
        ? getSystemPrompt(detectedPersona) +
          '\nIMPORTANT: The user has selected specific documents. You MUST use the searchKnowledge tool to find information before answering. Only respond using information from tool results. If no relevant information is found, say so.' +
          (memoryContext ? `\n\n${memoryContext}` : '')
        : getSystemPrompt(detectedPersona) + (memoryContext ? `\n\n${memoryContext}` : '');

    const enabledIds = enabledModelIds && enabledModelIds.length > 0
      ? enabledModelIds.filter((modelId) =>
          availableModels.some((option) => option.id === modelId)
        )
      : availableModels.map((option) => option.id);
    // Agent suggested model is used when user hasn't explicitly chosen a model
    const agentSuggestedModel = activeAgent?.modelId ?? null;
    const manualModel = model && model !== 'auto' ? model : (agentSuggestedModel ?? null);
    const manualResolved = manualModel && enabledIds.includes(manualModel)
      ? manualModel
      : null;
    // Only load scores for auto-routing, skip for manual selection
    const userScores = manualResolved ? new Map<string, number>() : await getUserModelScores(session.user.id);

    const routingDecision = manualResolved
      ? { modelId: manualResolved, reason: 'Manual selection' }
      : getModelByIntent({
          prompt: lastUserPrompt,
          enabledModelIds: enabledIds.length > 0 ? enabledIds : [chatModel],
          useWebSearch,
          userScores,
        });
    const resolvedModel = routingDecision.modelId;
    const routingMetadata: RoutingMetadata = {
      mode: manualResolved ? 'manual' : 'auto',
      modelId: resolvedModel,
      reason: routingDecision.reason,
    };

    // Credit check
    const creditCost = getCreditCost(resolvedModel);
    const currentBalance = await getUserBalance(session.user.id);
    if (currentBalance < creditCost) {
      return Response.json(
        {
          error: `Insufficient credits. This model costs ${creditCost} credits, but you have ${currentBalance}. Please contact admin for more credits.`,
        },
        { status: 402 },
      );
    }

    const supportsTools = !toolDisabledModels.has(resolvedModel);
    const activeTools = supportsTools ? groundedTools : undefined;
    const systemPrompt = supportsTools
      ? groundedSystemPrompt
      : getSystemPrompt(detectedPersona) + (memoryContext ? `\n\n${memoryContext}` : '');

    // Feature 2: Enhance prompt if enabled
    let enhancedPrompt: string | undefined;
    let messagesToSend = messages;
    if (userPrefs.promptEnhancementEnabled && lastUserPrompt) {
      const enhanced = await enhancePrompt(lastUserPrompt, memoryContext);
      if (enhanced !== lastUserPrompt) {
        enhancedPrompt = enhanced;
        // Replace text in the last user message
        const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user');
        if (lastUserIdx !== -1) {
          messagesToSend = messages.map((m, i) => {
            if (i !== lastUserIdx) return m;
            return {
              ...m,
              parts: m.parts.map((p) =>
                p.type === 'text' ? { ...p, text: enhanced } : p
              ),
            };
          });
        }
      }
    }

    // Feature A: Conversation Summary Injection
    let conversationSummaryBlock = '';
    if (messages.length > SUMMARY_THRESHOLD) {
      const { summary, trimmedMessages } = await summarizeConversation(messagesToSend as import('@/features/chat/types').ChatMessage[]);
      if (summary) {
        conversationSummaryBlock = `\n\n<conversation_summary>\nSummary of earlier conversation:\n${summary}\n</conversation_summary>`;
        messagesToSend = trimmedMessages;
      }
    }
    const effectiveSystemPrompt = systemPrompt + conversationSummaryBlock;

    const currentTitle = thread[0]?.title ?? 'New chat';

    if (isImageOnlyModel(resolvedModel)) {
      const imagePrompt = enhancedPrompt ?? lastUserPrompt;
      if (!imagePrompt) {
        return Response.json({ error: 'Image generation requires a text prompt.' }, { status: 400 });
      }

      const imageResult = await generateImage({
        model: resolvedModel,
        prompt: imagePrompt,
      });

      const generatedImage = imageResult.image;
      const generatedImageDataUrl = `data:${generatedImage.mediaType};base64,${generatedImage.base64}`;

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        metadata: { routing: routingMetadata, persona: detectedPersona, ...(enhancedPrompt ? { enhancedPrompt } : {}) },
        parts: [
          {
            type: 'file',
            mediaType: generatedImage.mediaType,
            url: generatedImageDataUrl,
          },
        ],
      };

      await persistChatResult({
        updatedMessages: [...messages, assistantMessage],
        threadId,
        userId: session.user.id,
        currentTitle,
        resolvedModel,
        creditCost,
        tokenUsageData: {
          promptTokens: imageResult.usage.inputTokens,
          completionTokens: imageResult.usage.outputTokens,
          totalTokens: imageResult.usage.totalTokens,
        },
      });

      return createUIMessageStreamResponse({
        stream: createUIMessageStream<ChatMessage>({
          originalMessages: messages,
          execute: ({ writer }) => {
            writer.write({
              type: 'start',
              messageMetadata: { routing: routingMetadata, persona: detectedPersona, ...(enhancedPrompt ? { enhancedPrompt } : {}) },
            });
            writer.write({ type: 'start-step' });
            writer.write({
              type: 'file',
              mediaType: generatedImage.mediaType,
              url: generatedImageDataUrl,
            });
            writer.write({ type: 'finish-step' });
            writer.write({ type: 'finish', finishReason: 'stop' });
          },
        }),
      });
    }

    const result = streamText({
      model: resolvedModel,
      system: effectiveSystemPrompt,
      messages: await convertToModelMessages(messagesToSend),
      stopWhen: stepCountIs(maxSteps),
      ...(supportsTools ? { tools: activeTools } : {}),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      messageMetadata: () => ({ routing: routingMetadata, persona: detectedPersona, ...(enhancedPrompt ? { enhancedPrompt } : {}) }),
      onFinish: async ({ messages: updatedMessages }) => {
        const usage: unknown = await result.usage;
        const typedUsage = usage as TokenUsageSnapshot | null;

        // Feature 4: Generate follow-up suggestions and inject into last assistant message
        const typedMessages = updatedMessages as ChatMessage[];
        const lastAssistantIdx = typedMessages.map((m) => m.role).lastIndexOf('assistant');
        let messagesWithSuggestions = typedMessages;

        if (lastAssistantIdx !== -1) {
          const contextStr = typedMessages.slice(-6)
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
          userId: session.user.id,
          currentTitle,
          resolvedModel,
          creditCost,
          tokenUsageData: typedUsage,
        });

        // Feature 3: Extract and store memory (fire-and-forget)
        if (userPrefs.memoryEnabled) {
          void extractAndStoreMemory(
            session.user.id,
            messagesWithSuggestions as Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>,
            threadId,
            memoryContext,
          );
        }
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}