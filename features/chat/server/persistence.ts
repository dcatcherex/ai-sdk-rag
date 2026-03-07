import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { chatMessage, chatThread, mediaAsset, tokenUsage } from '@/db/schema';
import { deductCredits } from '@/lib/credits';
import type { ChatMessage } from '@/features/chat/types';
import type { TokenUsageSnapshot } from './schema';
import { isImageFilePart, uploadImagePart } from './image-upload';
import { getThreadPreviewFromMessages, getThreadTitleFromMessages } from './thread-utils';

type PersistChatResultOptions = {
  updatedMessages: ChatMessage[];
  threadId: string;
  userId: string;
  currentTitle: string;
  resolvedModel: string;
  creditCost: number;
  tokenUsageData?: TokenUsageSnapshot | null;
};

export const persistChatResult = async (options: PersistChatResultOptions): Promise<void> => {
  const { updatedMessages, threadId, userId, currentTitle, resolvedModel, creditCost, tokenUsageData } =
    options;

  // Assign stable IDs and upload any inline data-URL images to R2
  const messagesWithIds = updatedMessages.map((m) => ({ ...m, id: m.id || crypto.randomUUID() }));

  const messageResults = await Promise.all(
    messagesWithIds.map(async (message) => {
      const partResults = await Promise.all(
        message.parts.map(async (part, index) => {
          if (!isImageFilePart(part as any)) return { part };
          return uploadImagePart({ part: part as any, threadId, messageId: message.id, index, userId });
        })
      );
      return {
        message: { ...message, parts: partResults.map((r) => r.part) },
        assets: partResults.flatMap((r) => (r.asset ? [r.asset] : [])),
      };
    })
  );

  const chatMessages = messageResults.map((r) => r.message);
  const assets = messageResults.flatMap((r) => r.assets);
  const preview = getThreadPreviewFromMessages(chatMessages);
  const nextTitle =
    currentTitle === 'New chat'
      ? (getThreadTitleFromMessages(chatMessages) ?? currentTitle)
      : currentTitle;

  // Preserve compare messages: they are managed by /api/compare, not this chat session
  const existingRows = await db.select().from(chatMessage).where(eq(chatMessage.threadId, threadId));
  const compareRows = existingRows.filter((row) => {
    const meta = row.metadata as { compareGroupId?: string } | null;
    return !!meta?.compareGroupId;
  });

  await db.delete(chatMessage).where(eq(chatMessage.threadId, threadId));

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

  // Re-insert compare messages not already included in the main flow
  const mainMessageIds = new Set(chatMessages.map((m) => m.id));
  const orphanedCompareRows = compareRows.filter((r) => !mainMessageIds.has(r.id));
  if (orphanedCompareRows.length > 0) {
    await db.insert(chatMessage).values(orphanedCompareRows);
  }

  if (assets.length > 0) {
    await db.insert(mediaAsset).values(assets);
  }

  await deductCredits({
    userId,
    amount: creditCost,
    description: `Chat: ${resolvedModel} (thread ${threadId})`,
  }).catch((e) => console.error('Failed to deduct credits:', e));

  if (tokenUsageData) {
    await db
      .insert(tokenUsage)
      .values({
        id: nanoid(),
        threadId,
        model: resolvedModel,
        promptTokens: tokenUsageData.promptTokens || 0,
        completionTokens: tokenUsageData.completionTokens || 0,
        totalTokens:
          tokenUsageData.totalTokens ||
          (tokenUsageData.promptTokens || 0) + (tokenUsageData.completionTokens || 0),
      })
      .catch((e) => console.error('Failed to track token usage:', e));
  }

  await db
    .update(chatThread)
    .set({ preview, title: nextTitle, updatedAt: new Date() })
    .where(eq(chatThread.id, threadId));
};
