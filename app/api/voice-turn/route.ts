import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatThread, chatMessage } from '@/db/schema';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { threadId?: string; userText?: string; aiText?: string };
  const { threadId, userText = '', aiText = '' } = body;

  if (!threadId) {
    return NextResponse.json({ error: 'threadId is required' }, { status: 400 });
  }

  // Verify thread belongs to the authenticated user
  const [thread] = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)))
    .limit(1);

  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }

  // Count existing messages to determine next position indices
  const [{ value: existingCount }] = await db
    .select({ value: count() })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId));

  const now = new Date();
  const userMessageId = crypto.randomUUID();
  const aiMessageId = crypto.randomUUID();

  const messagesToInsert = [];
  let nextPosition = existingCount;

  if (userText) {
    messagesToInsert.push({
      id: userMessageId,
      threadId,
      role: 'user',
      parts: [{ type: 'text', text: userText }],
      metadata: { source: 'voice' },
      position: nextPosition++,
      createdAt: now,
    });
  }

  if (aiText) {
    messagesToInsert.push({
      id: aiMessageId,
      threadId,
      role: 'assistant',
      parts: [{ type: 'text', text: aiText }],
      metadata: { source: 'voice' },
      position: nextPosition++,
      createdAt: now,
    });
  }

  if (messagesToInsert.length > 0) {
    await db.insert(chatMessage).values(messagesToInsert);
  }

  // Update thread preview and updatedAt
  const preview = aiText
    ? aiText.slice(0, 100)
    : userText.slice(0, 100);

  if (preview) {
    await db
      .update(chatThread)
      .set({ preview, updatedAt: now })
      .where(eq(chatThread.id, threadId));
  }

  return NextResponse.json({ ok: true, userMessageId, aiMessageId });
}
