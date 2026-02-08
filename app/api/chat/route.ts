import {
  streamText,
  type UIMessage,
  type UIDataTypes,
  convertToModelMessages,
  stepCountIs,
} from 'ai';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { availableModels, type Capability, chatModel, maxSteps } from '@/lib/ai';
import { env } from '@/lib/env';
import { getSystemPrompt } from '@/lib/prompt';
import { baseTools, tools, type ChatTools } from '@/lib/tools';
import { createScopedRagTools } from '@/lib/rag-tool';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatMessage, chatThread, tokenUsage } from '@/db/schema';
import { nanoid } from 'nanoid';

export const maxDuration = 30;

export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;

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

const getModelByIntent = (options: {
  prompt: string | null;
  enabledModelIds: string[];
}) => {
  const { prompt, enabledModelIds } = options;
  const enabledModels = availableModels.filter((model) =>
    enabledModelIds.includes(model.id)
  );
  const safeFallback = enabledModels[0]?.id ?? chatModel;
  if (!prompt) {
    return safeFallback;
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
    return pickByCapability('image gen') ?? safeFallback;
  }

  if (wantsWeb) {
    return pickByCapability('web search') ?? safeFallback;
  }

  if (wantsCode) {
    return enabledModelIds.includes('openai/gpt-5.2')
      ? 'openai/gpt-5.2'
      : safeFallback;
  }

  if (wantsReasoning) {
    return enabledModelIds.includes('anthropic/claude-opus-4.6')
      ? 'anthropic/claude-opus-4.6'
      : safeFallback;
  }

  return enabledModelIds.includes('google/gemini-3-flash')
    ? 'google/gemini-3-flash'
    : safeFallback;
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
    const activeTools = isGrounded
      ? { ...baseTools, ...createScopedRagTools(selectedDocumentIds) }
      : baseTools;
    const systemPrompt = isGrounded
      ? getSystemPrompt('general_assistant') +
        '\nIMPORTANT: The user has selected specific documents. You MUST use the searchKnowledge tool to find information before answering. Only respond using information from tool results. If no relevant information is found, say so.'
      : getSystemPrompt('general_assistant');

    const enabledIds = enabledModelIds && enabledModelIds.length > 0
      ? enabledModelIds.filter((modelId) =>
          availableModels.some((option) => option.id === modelId)
        )
      : availableModels.map((option) => option.id);
    const resolvedModel = model && model !== 'auto'
      ? model
      : getModelByIntent({
          prompt: getLastUserPrompt(messages),
          enabledModelIds: enabledIds.length > 0 ? enabledIds : [chatModel],
        });

    const result = streamText({
      model: resolvedModel,
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(maxSteps),
      tools: activeTools,
    });

    const currentTitle = thread[0]?.title ?? 'New chat';

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ messages: updatedMessages }) => {
        const chatMessages = updatedMessages as ChatMessage[];
        const preview = getThreadPreviewFromMessages(chatMessages);
        const nextTitle =
          currentTitle === 'New chat'
            ? getThreadTitleFromMessages(chatMessages) ?? currentTitle
            : currentTitle;

        await db
          .delete(chatMessage)
          .where(eq(chatMessage.threadId, threadId));
        if (updatedMessages.length > 0) {
          await db.insert(chatMessage).values(
            updatedMessages.map((message, index) => ({
              id: message.id || crypto.randomUUID(),
              threadId,
              role: message.role,
              parts: message.parts,
              position: index,
            }))
          );
        }

        // Track token usage - get from the result after completion
        try {
          const usage: any = await result.usage;
          if (usage) {
            await db.insert(tokenUsage).values({
              id: nanoid(),
              threadId,
              model: resolvedModel,
              promptTokens: usage.promptTokens || 0,
              completionTokens: usage.completionTokens || 0,
              totalTokens: usage.totalTokens || (usage.promptTokens || 0) + (usage.completionTokens || 0),
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