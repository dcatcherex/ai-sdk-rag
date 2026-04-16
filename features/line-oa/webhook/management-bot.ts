/**
 * LINE Management Bot handler.
 *
 * Activates when the workspace OWNER (channel.userId === linkedUser.userId)
 * sends a message to their own LINE OA. Routes to the Vaja Platform Agent
 * instead of the customer-facing message handler.
 *
 * Separation from events/message.ts is intentional (guide §13, Rule 3).
 */

import { generateText } from 'ai';
import { asc, eq } from 'drizzle-orm';
import type { messagingApi } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { chatMessage, chatThread } from '@/db/schema';
import { nanoid } from 'nanoid';
import { chatModel } from '@/lib/ai';
import { getWorkspaceContext } from '@/features/platform-agent/service';
import {
  buildPlatformAgentSystemPrompt,
  LINE_PLATFORM_CONSTRAINT,
} from '@/features/platform-agent/prompts';
import { getPlatformAgentTools } from '@/features/platform-agent/agent';
import { stripMarkdown } from './utils/markdown';
import { getOrCreateConversation } from './db';
import { MAX_CONTEXT_MESSAGES } from './types';

type ManagementBotEvent = {
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string; id: string };
};

type ChannelInfo = {
  id: string;
  userId: string;          // Vaja account owner ID
  name: string;
  channelAccessToken: string;
};

/**
 * Handle a message from the workspace owner via their LINE OA.
 * Always uses the Vaja Platform Agent — never the channel's domain agent.
 */
export async function handleManagementBotEvent(
  event: ManagementBotEvent,
  channel: ChannelInfo,
  lineClient: messagingApi.MessagingApiClient,
): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId || !event.replyToken) return;

  // Only text messages are supported for management bot
  if (event.message?.type !== 'text' || !event.message.text) return;

  const userText = event.message.text.trim();
  const ownerId = channel.userId;

  // Ensure conversation thread exists (keyed per owner on this channel)
  const { threadId } = await getOrCreateConversation(
    channel.id,
    ownerId,
    lineUserId,
    `[Management] ${channel.name}`,
  );

  // Load recent history
  const historyRows = await db
    .select({ role: chatMessage.role, parts: chatMessage.parts })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(asc(chatMessage.position))
    .limit(MAX_CONTEXT_MESSAGES);

  const historyMessages = historyRows
    .map((row) => {
      const parts = row.parts as Array<{ type?: string; text?: string }>;
      const text = parts.find((p) => p.type === 'text')?.text ?? '';
      if (!text) return null;
      return { role: row.role as 'user' | 'assistant', content: text };
    })
    .filter((m): m is { role: 'user' | 'assistant'; content: string } => m !== null);

  // Build system prompt with workspace context + LINE constraints
  const workspaceCtx = await getWorkspaceContext(ownerId);
  const systemPrompt =
    buildPlatformAgentSystemPrompt(workspaceCtx) + LINE_PLATFORM_CONSTRAINT;

  // Load platform management tools scoped to the owner
  const tools = getPlatformAgentTools({ userId: ownerId });

  let replyText: string;
  try {
    const result = await generateText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: chatModel as any,
      system: systemPrompt,
      messages: [...historyMessages, { role: 'user', content: userText }],
      ...(tools ? { tools, maxSteps: 3 } : {}),
    });

    replyText = result.text;

    // Append the first actionUrl from tool results as a deep link (cross-channel continuity)
    if (!replyText && result.toolResults?.length) {
      const firstResult = result.toolResults[0] as { output?: { message?: string; actionUrl?: string } };
      replyText = firstResult?.output?.message ?? '';
    }

    // Append actionUrl from tool output if present and fits within limit
    const actionUrl = (result.toolResults ?? [])
      .map((tr) => (tr as { output?: { actionUrl?: string } }).output?.actionUrl)
      .find(Boolean);
    if (actionUrl && replyText && replyText.length < 340) {
      replyText += `\n🔗 ${actionUrl}`;
    }
  } catch (err) {
    console.error('[LINE management bot] generateText failed:', err);
    replyText = 'ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
  }

  if (!replyText) return;

  // Strip markdown and enforce 400-char LINE limit
  const cleanReply = stripMarkdown(replyText).slice(0, 400);

  // Persist messages to the thread
  const now = new Date();
  const existingCount = historyRows.length;
  await Promise.all([
    db.insert(chatMessage).values([
      {
        id: crypto.randomUUID(),
        threadId,
        role: 'user',
        parts: [{ type: 'text', text: userText }],
        position: existingCount,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        threadId,
        role: 'assistant',
        parts: [{ type: 'text', text: cleanReply }],
        position: existingCount + 1,
        createdAt: now,
      },
    ]),
    db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId)),
  ]);

  await lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: cleanReply }],
  });
}
