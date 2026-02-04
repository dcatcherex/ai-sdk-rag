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
import { chatModel, maxSteps } from '@/lib/ai';
import { env } from '@/lib/env';
import { getSystemPrompt } from '@/lib/prompt';
import { tools, type ChatTools } from '@/lib/tools';
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

export async function POST(req: Request) {
  env.AI_GATEWAY_API_KEY;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, threadId, model } = requestSchema.parse(await req.json());

    const thread = await db
      .select({ id: chatThread.id, title: chatThread.title })
      .from(chatThread)
      .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)))
      .limit(1);

    if (thread.length === 0) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const result = streamText({
      model: model || chatModel,
      system: getSystemPrompt('general_assistant'),
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(maxSteps),
      tools,
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
              model: model || chatModel,
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