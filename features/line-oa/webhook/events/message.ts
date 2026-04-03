import { generateText, generateImage } from 'ai';
import { asc, eq } from 'drizzle-orm';
import { messagingApi } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { chatMessage, chatThread } from '@/db/schema';
import { generateFollowUpSuggestions } from '@/lib/follow-up-suggestions';
import { getUserMemoryContext, extractAndStoreMemory } from '@/lib/memory';
import type { AgentRow, LineMessage, LinkedUser, MessagePart, Sender } from '../types';
import { MAX_CONTEXT_MESSAGES } from '../types';
import { getOrCreateConversation } from '../db';
import { buildReplyMessages } from '../flex';
import { buildQuickReplyItem } from '../utils/quick-reply';
import { extractTextContent } from '../utils/text';
import { stripMarkdown } from '../utils/markdown';
import { consumeLinkToken } from '@/features/line-oa/link/service';
import { uploadPublicObject } from '@/lib/r2';

/** Default model used for LINE image generation requests */
const LINE_IMAGE_MODEL = 'openai/gpt-image-1.5';

type LineEvent = {
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string; id: string };
};

type ChannelInfo = {
  id: string;
  userId: string;
  name: string;
  channelAccessToken: string;
};

/** Returns true when the user's text is asking to generate an image */
function wantsImageGeneration(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.startsWith('create image') ||
    lower.startsWith('generate image') ||
    lower.includes('image of') ||
    lower.includes('draw ') ||
    lower.includes('illustration')
  );
}

/** Read an AsyncIterable stream into a Buffer */
async function streamToBuffer(stream: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk as Buffer));
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/**
 * Handle an inbound message event (text or image).
 *
 * Text flow:
 *   image-gen intent  → generateImage → R2 upload → LINE image message
 *   otherwise         → generateText  → Flex / plain text reply
 *
 * Image flow (user sent a photo):
 *   download from LINE Content API → vision model → text reply
 */
export async function handleMessageEvent(
  event: LineEvent,
  channel: ChannelInfo,
  lineClient: messagingApi.MessagingApiClient,
  agentRow: AgentRow,
  sender: Sender | undefined,
  systemPrompt: string,
  modelId: string,
  linkedUser?: LinkedUser,
): Promise<void> {
  if (!event.replyToken) return;

  const msgType = event.message?.type;
  if (msgType !== 'text' && msgType !== 'image') return;

  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  // ① Account link command — text only
  if (msgType === 'text') {
    const userText = event.message!.text?.trim() ?? '';
    if (!userText) return;

    const linkMatch = userText.match(/^\/link\s+([A-Z2-9]{8})$/i);
    if (linkMatch) {
      const token = linkMatch[1]!.toUpperCase();
      const result = await consumeLinkToken(token, lineUserId, channel.id, lineClient);
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: result.message }],
      });
      return;
    }
  }

  // ② Loading animation — fire-and-forget
  lineClient
    .showLoadingAnimation({ chatId: lineUserId, loadingSeconds: 30 })
    .catch((err) => console.warn('[LINE] showLoadingAnimation failed:', err));

  const { threadId } = await getOrCreateConversation(
    channel.id,
    channel.userId,
    lineUserId,
    channel.name,
  );

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

  let memoryContext = '';
  if (linkedUser) {
    memoryContext = await getUserMemoryContext(linkedUser.userId);
  }

  let lineSystemPrompt =
    systemPrompt +
    '\n\nIMPORTANT: You are replying via LINE messaging. ' +
    'Do NOT use markdown syntax (no **bold**, no # headers, no backticks). ' +
    'Use plain text only. For lists, use • as bullet character.';

  if (linkedUser) {
    if (linkedUser.displayName) {
      lineSystemPrompt += `\n\nThe user you are talking to is named ${linkedUser.displayName}. Address them by name naturally when appropriate.`;
    }
    if (memoryContext) {
      lineSystemPrompt += `\n\nWhat you already know about this user:\n${memoryContext}`;
    }
  }

  const now = new Date();
  const nextPosition = historyRows.length;

  // ③ Incoming image from user → vision model → text reply
  if (msgType === 'image') {
    const blobClient = new messagingApi.MessagingApiBlobClient({
      channelAccessToken: channel.channelAccessToken,
    });

    const stream = await blobClient.getMessageContent(event.message!.id);
    const imageBuffer = await streamToBuffer(stream as unknown as AsyncIterable<Uint8Array>);
    const base64 = imageBuffer.toString('base64');

    const { text: rawAnalysis } = await generateText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: modelId as any,
      system: lineSystemPrompt,
      messages: [
        ...historyMessages,
        {
          role: 'user' as const,
          content: [{ type: 'image' as const, image: base64, mediaType: 'image/jpeg' }],
        },
      ],
    });

    if (!rawAnalysis) return;
    const analysisText = stripMarkdown(rawAnalysis);

    const contextStr = `user: [sent an image]\nassistant: ${analysisText.slice(0, 200)}`;
    const [suggestions] = await Promise.all([
      generateFollowUpSuggestions(contextStr),
      db.insert(chatMessage).values([
        {
          id: crypto.randomUUID(),
          threadId,
          role: 'user',
          parts: [{ type: 'text', text: '[Image]' }],
          position: nextPosition,
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
          threadId,
          role: 'assistant',
          parts: [{ type: 'text', text: analysisText }],
          position: nextPosition + 1,
          createdAt: now,
        },
      ]),
      db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId)),
    ]);

    if (linkedUser) {
      const messagesForMemory = [
        ...historyMessages,
        { role: 'user' as const, content: '[Image]' },
        { role: 'assistant' as const, content: analysisText },
      ];
      void extractAndStoreMemory(linkedUser.userId, messagesForMemory, threadId, memoryContext);
    }

    const quickReplyItems = suggestions
      .filter((s) => s.trim().length > 0)
      .slice(0, 3)
      .map((s) => buildQuickReplyItem(s));
    const quickReply = quickReplyItems.length > 0 ? { items: quickReplyItems } : undefined;

    const replyMessages = buildReplyMessages(analysisText, sender, quickReply);
    await lineClient.replyMessage({ replyToken: event.replyToken, messages: replyMessages });
    return;
  }

  // ④ Text message
  const userText = event.message!.text!.trim();

  // ④a Image generation request
  if (wantsImageGeneration(userText)) {
    try {
      const imageResult = await generateImage({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: LINE_IMAGE_MODEL as any,
        prompt: userText,
      });
      const { base64, mediaType } = imageResult.image;
      const ext = mediaType.includes('png') ? 'png' : 'jpg';
      const key = `line-images/${crypto.randomUUID()}.${ext}`;
      const { url } = await uploadPublicObject({
        key,
        body: Buffer.from(base64, 'base64'),
        contentType: mediaType,
      });

      await Promise.all([
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
            parts: [{ type: 'text', text: `[Generated image: ${url}]` }],
            position: nextPosition + 1,
            createdAt: now,
          },
        ]),
        db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId)),
      ]);

      const imageMsg: LineMessage = {
        type: 'image',
        originalContentUrl: url,
        previewImageUrl: url,
      } as LineMessage;
      await lineClient.replyMessage({ replyToken: event.replyToken, messages: [imageMsg] });
      return;
    } catch (err) {
      console.error('[LINE] Image generation failed, falling back to text:', err);
      // Fall through to text response
    }
  }

  // ④b Standard text → text response
  const { text: rawReplyText } = await generateText({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: modelId as any,
    system: lineSystemPrompt,
    messages: [...historyMessages, { role: 'user', content: userText }],
  });

  if (!rawReplyText) return;
  const replyText = stripMarkdown(rawReplyText);

  const contextStr = [
    ...historyMessages.slice(-4).map((m) => `${m.role}: ${m.content.slice(0, 200)}`),
    `user: ${userText}`,
    `assistant: ${replyText.slice(0, 200)}`,
  ].join('\n');

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

  if (linkedUser) {
    const messagesForMemory = [
      ...historyMessages,
      { role: 'user' as const, content: userText },
      { role: 'assistant' as const, content: replyText },
    ];
    void extractAndStoreMemory(linkedUser.userId, messagesForMemory, threadId, memoryContext);
  }

  const quickReplyItems = suggestions
    .filter((s) => s.trim().length > 0)
    .slice(0, 3)
    .map((s) => buildQuickReplyItem(s));
  const quickReply = quickReplyItems.length > 0 ? { items: quickReplyItems } : undefined;

  const messages = buildReplyMessages(replyText, sender, quickReply);
  await lineClient.replyMessage({ replyToken: event.replyToken, messages });
}
