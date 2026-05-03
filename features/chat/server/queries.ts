import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatThread, user as userTable, userPreferences } from '@/db/schema';

export async function checkUserApproved(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ approved: userTable.approved })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return row?.approved ?? false;
}

export async function getThreadForSession(input: {
  threadId: string;
  userId: string | null;
  guestSessionId: string | null;
}): Promise<{ id: string; title: string | null } | null> {
  const { threadId, userId, guestSessionId } = input;
  const rows = userId
    ? await db
        .select({ id: chatThread.id, title: chatThread.title })
        .from(chatThread)
        .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, userId)))
        .limit(1)
    : guestSessionId
      ? await db
          .select({ id: chatThread.id, title: chatThread.title })
          .from(chatThread)
          .where(and(eq(chatThread.id, threadId), eq(chatThread.guestSessionId, guestSessionId)))
          .limit(1)
      : [];
  return rows[0] ?? null;
}

export async function getUserPrefs(userId: string) {
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return row ?? null;
}
