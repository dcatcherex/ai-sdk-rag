import { generateText } from 'ai';
import { asc, eq } from 'drizzle-orm';
import type { messagingApi } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { chatMessage, chatThread } from '@/db/schema';
import { generateFollowUpSuggestions } from '@/lib/follow-up-suggestions';
import type { AgentRow, MessagePart, Sender } from '../types';
import { MAX_CONTEXT_MESSAGES } from '../types';
import { getOrCreateConversation } from '../db';
import { buildReplyMessages } from '../flex';
import { buildQuickReplyItem } from '../utils/quick-reply';
import { extractTextContent } from '../utils/text';
import { stripMarkdown } from '../utils/markdown';

type LineEvent = {
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string; id: string };
};

type ChannelInfo = {
  id: string;
  userId: string;
  name: string;
};

/**
 * Handle an inbound text message event.
 * Orchestrates: loading indicator → history load → AI generation →
 * quick reply suggestions → DB persist → Flex/text reply.
 */
export async function handleMessageEvent(
  event: LineEvent,
  channel: ChannelInfo,
  lineClient: messagingApi.MessagingApiClient,
  agentRow: AgentRow,
  sender: Sender | undefined,
  systemPrompt: string,
  modelId: string,
): Promise<void> {
  if (
    event.message?.type !== 'text' ||
    !event.message.text ||
    !event.replyToken
  ) {
    return;
  }

  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  const userText = event.message.text.trim();
  if (!userText) return;

  // ① Loading animation — fire immediately, non-blocking
  lineClient
    .showLoadingAnimation({ chatId: lineUserId, loadingSeconds: 30 })
    .catch((err) => console.warn('[LINE] showLoadingAnimation failed:', err));

  // Get or create conversation thread
  const { threadId } = await getOrCreateConversation(
    channel.id,
    channel.userId,
    lineUserId,
    channel.name,
  );

  // Load conversation history
  const historyRows = await db
    .select({ role: chatMessage.role, parts: chatMessage.parts })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(asc(chatMessage.position))
    .limit(MAX_CONTEXT_MESSAGES);

  const historyMessages = historyRows
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .map((r) => ({
      role: r.role as 'user' | 'assistant',
      content: extractTextContent(r.parts as MessagePart[]),
    }))
    .filter((m) => m.content.length > 0);

  // LINE-specific system prompt: no markdown, use • for bullets
  const lineSystemPrompt =
    systemPrompt +
    '\n\nIMPORTANT: You are replying via LINE messaging. ' +
    'Do NOT use markdown syntax (no **bold**, no # headers, no backticks). ' +
    'Use plain text only. For lists, use • as bullet character.';

  const { text: rawReplyText } = await generateText({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: modelId as any,
    system: lineSystemPrompt,
    messages: [...historyMessages, { role: 'user', content: userText }],
  });

  if (!rawReplyText) return;

  // Strip any residual markdown the model may still produce
  const replyText = stripMarkdown(rawReplyText);

  // Build context string for follow-up suggestion generation
  const contextStr = [
    ...historyMessages.slice(-4).map((m) => `${m.role}: ${m.content.slice(0, 200)}`),
    `user: ${userText}`,
    `assistant: ${replyText.slice(0, 200)}`,
  ].join('\n');

  const now = new Date();
  const nextPosition = historyRows.length;

  // ③ Quick replies + DB persist in parallel
  const [suggestions] = await Promise.all([
    generateFollowUpSuggestions(contextStr),
    db.insert(chatMessage).values([
      {
        id: crypto.randomUUID(),
        threadId,
        role: 'user',
        parts: [{ type: 'text', text: userText }],
        position: nextPosition,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        threadId,
        role: 'assistant',
        parts: [{ type: 'text', text: replyText }],
        position: nextPosition + 1,
        createdAt: now,
      },
    ]),
    db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId)),
  ]);

  const quickReplyItems = suggestions
    .filter((s) => s.trim().length > 0)
    .slice(0, 3)
    .map((s) => buildQuickReplyItem(s));

  const quickReply = quickReplyItems.length > 0 ? { items: quickReplyItems } : undefined;

  // ⑤ Build Flex or plain text reply
  const messages = buildReplyMessages(replyText, sender, quickReply);

  await lineClient.replyMessage({ replyToken: event.replyToken, messages });
}
