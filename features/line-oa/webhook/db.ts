import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { chatThread, lineConversation } from '@/db/schema';

export async function getOrCreateConversation(
  channelId: string,
  userId: string,
  lineUserId: string,
  channelName: string,
  groupId?: string,
): Promise<{ threadId: string }> {
  // For group chats the conversation key is the groupId; lineUserId is the individual sender
  const conversationKey = groupId ?? lineUserId;

  const existing = await db
    .select({ threadId: lineConversation.threadId })
    .from(lineConversation)
    .where(
      and(
        eq(lineConversation.channelId, channelId),
        eq(lineConversation.lineUserId, conversationKey),
      ),
    )
    .limit(1);

  if (existing.length > 0) return { threadId: existing[0]!.threadId };

  const threadId = nanoid();
  const now = new Date();
  const title = groupId ? `LINE Group: ${channelName}` : `LINE: ${channelName}`;

  await db.insert(chatThread).values({
    id: threadId,
    userId,
    title,
    preview: '',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(lineConversation).values({
    id: crypto.randomUUID(),
    channelId,
    lineUserId: conversationKey,
    threadId,
    groupId: groupId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return { threadId };
}
