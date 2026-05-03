import type { ChatMessage } from '@/features/chat/types';
import type { ImageFilePart, MediaAssetInsert, UploadPartResult } from './schema';
import { getThreadPreviewFromMessages, getThreadTitleFromMessages } from './thread-utils';

export type ChatMessageInsertRow = {
  id: string;
  threadId: string;
  role: ChatMessage['role'];
  parts: ChatMessage['parts'];
  metadata: ChatMessage['metadata'] | null;
  position: number;
};

export type PersistableChatPart = ChatMessage['parts'][number];

export type IsImageFilePartFn = (part: PersistableChatPart) => part is ImageFilePart;

export type UploadImagePartFn = (options: {
  part: ImageFilePart;
  threadId: string;
  messageId: string;
  index: number;
  userId: string;
}) => Promise<UploadPartResult>;

export async function preparePersistableChatMessages(input: {
  updatedMessages: ChatMessage[];
  threadId: string;
  userId: string | null;
  isImageFilePart: IsImageFilePartFn;
  uploadImagePart: UploadImagePartFn;
}): Promise<{ messages: ChatMessage[]; assets: MediaAssetInsert[] }> {
  const { updatedMessages, threadId, userId, isImageFilePart, uploadImagePart } = input;
  const messagesWithIds = updatedMessages.map((message) => ({
    ...message,
    id: message.id || crypto.randomUUID(),
  }));

  const messageResults = await Promise.all(
    messagesWithIds.map(async (message) => {
      const partResults = await Promise.all(
        message.parts.map(async (part, index) => {
          if (!userId || !isImageFilePart(part)) return { part };
          return uploadImagePart({
            part,
            threadId,
            messageId: message.id,
            index,
            userId,
          });
        }),
      );

      return {
        message: {
          ...message,
          parts: partResults.map((result) => result.part),
        },
        assets: partResults.flatMap((result) => (result.asset ? [result.asset] : [])),
      };
    }),
  );

  return {
    messages: messageResults.map((result) => result.message),
    assets: messageResults.flatMap((result) => result.assets),
  };
}

export function buildChatMessageInsertRows(threadId: string, messages: ChatMessage[]): ChatMessageInsertRow[] {
  return messages.map((message, index) => ({
    id: message.id,
    threadId,
    role: message.role,
    parts: message.parts,
    metadata: message.metadata ?? null,
    position: index,
  }));
}

export function selectOrphanedPreservedRows<T extends { id: string; metadata: unknown }>(
  existingRows: T[],
  mainMessageIds: Set<string>,
): T[] {
  return existingRows.filter((row) => {
    const metadata = row.metadata as { compareGroupId?: string; teamRun?: unknown } | null;
    const shouldPreserve = Boolean(metadata?.compareGroupId || metadata?.teamRun);
    return shouldPreserve && !mainMessageIds.has(row.id);
  });
}

export function buildThreadUpdateValues(input: {
  messages: ChatMessage[];
  currentTitle: string;
  brandId?: string | null;
}): {
  preview: string;
  title: string;
  updatedAt: Date;
  brandId?: string | null;
} {
  const { messages, currentTitle, brandId } = input;
  const preview = getThreadPreviewFromMessages(messages);
  const title =
    currentTitle === 'New chat'
      ? (getThreadTitleFromMessages(messages) ?? currentTitle)
      : currentTitle;

  return {
    preview,
    title,
    updatedAt: new Date(),
    ...(brandId !== undefined ? { brandId: brandId ?? null } : {}),
  };
}
