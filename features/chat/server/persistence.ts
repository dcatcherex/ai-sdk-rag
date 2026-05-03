import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatMessage, chatThread, mediaAsset, tokenUsage } from '@/db/schema';
import { deductCredits } from '@/lib/credits';
import { deductGuestCredits } from '@/lib/guest-access';
import type { ChatMessage } from '@/features/chat/types';
import type { TokenUsageSnapshot } from './schema';
import { finalizeChatBilling } from './billing';
import { isImageFilePart, uploadImagePart } from './image-upload';
import {
  buildChatMessageInsertRows,
  buildThreadUpdateValues,
  preparePersistableChatMessages,
  selectOrphanedPreservedRows,
} from './message-persistence';
import { buildTokenUsageInsert } from './token-usage';

type PersistChatResultOptions = {
  updatedMessages: ChatMessage[];
  threadId: string;
  userId: string | null;
  guestSessionId?: string | null;
  currentTitle: string;
  resolvedModel: string;
  creditCost: number;
  tokenUsageData?: TokenUsageSnapshot | null;
  brandId?: string | null;
};

export const persistChatResult = async (options: PersistChatResultOptions): Promise<void> => {
  const { updatedMessages, threadId, userId, guestSessionId, currentTitle, resolvedModel, creditCost, tokenUsageData, brandId } =
    options;

  const prepared = await preparePersistableChatMessages({
    updatedMessages,
    threadId,
    userId,
    isImageFilePart,
    uploadImagePart,
  });
  const chatMessages = prepared.messages;
  const assets = prepared.assets;

  // Preserve compare + team-run messages: managed by their own routes, not this chat session
  const existingRows = await db.select().from(chatMessage).where(eq(chatMessage.threadId, threadId));
  const mainMessageIds = new Set(chatMessages.map((message) => message.id));
  const orphanedCompareRows = selectOrphanedPreservedRows(existingRows, mainMessageIds);

  await db.delete(chatMessage).where(eq(chatMessage.threadId, threadId));

  if (chatMessages.length > 0) {
    await db.insert(chatMessage).values(buildChatMessageInsertRows(threadId, chatMessages));
  }

  // Re-insert compare messages not already included in the main flow
  if (orphanedCompareRows.length > 0) {
    await db.insert(chatMessage).values(orphanedCompareRows);
  }

  if (assets.length > 0) {
    await db.insert(mediaAsset).values(assets);
  }

  await db
    .update(chatThread)
    .set(buildThreadUpdateValues({
      messages: chatMessages,
      currentTitle,
      brandId,
    }))
    .where(eq(chatThread.id, threadId));

  if (tokenUsageData) {
    await db
      .insert(tokenUsage)
      .values(buildTokenUsageInsert({
        threadId,
        model: resolvedModel,
        tokenUsageData,
      }))
      .catch((e) => console.error('Failed to track token usage:', e));
  }

  await finalizeChatBilling({
    userId,
    guestSessionId,
    creditCost,
    resolvedModel,
    threadId,
    deductUserCredits: deductCredits,
    deductGuestCredits,
  });
};
