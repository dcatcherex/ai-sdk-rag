import {
  streamText,
  type UIMessage,
  type UIDataTypes,
  type UIMessagePart,
  convertToModelMessages,
  stepCountIs,
} from 'ai';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { availableModels, type Capability, chatModel, maxSteps } from '@/lib/ai';
import { env } from '@/lib/env';
import { getSystemPrompt } from '@/lib/prompt';
import { baseTools, type ChatTools } from '@/lib/tools';
import { createScopedRagTools } from '@/lib/rag-tool';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatMessage, chatThread, mediaAsset, tokenUsage } from '@/db/schema';
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
      id: nanoid(),
      userId,
      threadId,
      messageId,
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
  selectedDocumentIds: z.array(z.string()).optional(),
  enabledModelIds: z.array(z.string()).optional(),
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

const getModelByIntent = (options: {
  prompt: string | null;
  enabledModelIds: string[];
}): RoutingDecision => {
  const { prompt, enabledModelIds } = options;
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

  const pickByCapability = (capability: Capability) =>
    enabledModels.find((model) =>
      (model.capabilities ?? []).some((modelCapability) => modelCapability === capability)
    )?.id;

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

  return enabledModelIds.includes('google/gemini-3-flash')
    ? { modelId: 'google/gemini-3-flash', reason: 'General chat' }
    : fallback;
};

const toolDisabledModels = new Set(['google/gemini-2.5-flash-image']);

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
      selectedDocumentIds,
      enabledModelIds,
    } = requestSchema.parse(await req.json());

    const thread = await db
      .select({ id: chatThread.id, title: chatThread.title })
      .from(chatThread)
      .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)))
      .limit(1);

    if (thread.length === 0) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Determine tools and system prompt based on document selection
    const isGrounded = selectedDocumentIds && selectedDocumentIds.length > 0;
    const groundedTools = isGrounded
      ? { ...baseTools, ...createScopedRagTools(selectedDocumentIds) }
      : baseTools;
    const groundedSystemPrompt = isGrounded
      ? getSystemPrompt('general_assistant') +
        '\nIMPORTANT: The user has selected specific documents. You MUST use the searchKnowledge tool to find information before answering. Only respond using information from tool results. If no relevant information is found, say so.'
      : getSystemPrompt('general_assistant');

    const enabledIds = enabledModelIds && enabledModelIds.length > 0
      ? enabledModelIds.filter((modelId) =>
          availableModels.some((option) => option.id === modelId)
        )
      : availableModels.map((option) => option.id);
    const manualModel = model && model !== 'auto' ? model : null;
    const manualResolved = manualModel && enabledIds.includes(manualModel)
      ? manualModel
      : null;
    const routingDecision = manualResolved
      ? { modelId: manualResolved, reason: 'Manual selection' }
      : getModelByIntent({
          prompt: getLastUserPrompt(messages),
          enabledModelIds: enabledIds.length > 0 ? enabledIds : [chatModel],
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
      : getSystemPrompt('general_assistant');

    const result = streamText({
      model: resolvedModel,
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(maxSteps),
      ...(supportsTools ? { tools: activeTools } : {}),
    });

    const currentTitle = thread[0]?.title ?? 'New chat';

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      messageMetadata: () => ({ routing: routingMetadata }),
      onFinish: async ({ messages: updatedMessages }) => {
        const messagesWithIds: ChatMessage[] = (updatedMessages as ChatMessage[]).map(
          (message) => ({
            ...message,
            id: message.id || crypto.randomUUID(),
          })
        );
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
                  userId: session.user.id,
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
            userId: session.user.id,
            amount: creditCost,
            description: `Chat: ${resolvedModel} (thread ${threadId})`,
          });
        } catch (creditError) {
          console.error('Failed to deduct credits:', creditError);
        }

        // Track token usage - get from the result after completion
        try {
          const usage: unknown = await result.usage;
          const typedUsage = usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
          if (typedUsage) {
            await db.insert(tokenUsage).values({
              id: nanoid(),
              threadId,
              model: resolvedModel,
              promptTokens: typedUsage.promptTokens || 0,
              completionTokens: typedUsage.completionTokens || 0,
              totalTokens: typedUsage.totalTokens || (typedUsage.promptTokens || 0) + (typedUsage.completionTokens || 0),
            });
          }
        } catch (error) {
          console.error('Failed to track token usage:', error);
        }

        await db
          .update(chatThread)
          .set({ preview, title: nextTitle, updatedAt: new Date() })
          .where(eq(chatThread.id, threadId));
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}