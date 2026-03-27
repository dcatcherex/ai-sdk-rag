import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { chatThread, lineConversation } from '@/db/schema';

export async function getOrCreateConversation(
  channelId: string,
  userId: string,
  lineUserId: string,
  channelName: string,
): Promise<{ threadId: string }> {
  const existing = await db
    .select({ threadId: lineConversation.threadId })
    .from(lineConversation)
    .where(
      and(
        eq(lineConversation.channelId, channelId),
        eq(lineConversation.lineUserId, lineUserId),
      ),
    )
    .limit(1);

  if (existing.length > 0) return { threadId: existing[0]!.threadId };

  const threadId = nanoid();
  const now = new Date();

  await db.insert(chatThread).values({
    id: threadId,
    userId,
    title: `LINE: ${channelName}`,
    preview: '',
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(lineConversation).values({
    id: crypto.randomUUID(),
    channelId,
    lineUserId,
    threadId,
    createdAt: now,
    updatedAt: now,
  });

  return { threadId };
}
