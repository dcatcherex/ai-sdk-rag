import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { chatThread, chatMessage } from '@/db/schema';

const voiceTurnMetadataSchema = z.object({
  provider: z.enum(['openai', 'gemini']),
  realtimeModel: z.string().min(1).max(120).optional(),
  activatedSkills: z.array(z.object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(160),
    source: z.enum(['rule', 'model']),
  })).max(20).optional(),
  toolCalls: z.array(z.object({
    name: z.string().min(1).max(120),
    callId: z.string().min(1).max(160).optional(),
    ok: z.boolean(),
    durationMs: z.number().int().min(0).max(300_000).optional(),
    error: z.string().max(500).optional(),
  })).max(50).optional(),
}).optional();

const voiceTurnRequestSchema = z.object({
  threadId: z.string().min(1),
  userText: z.string().default(''),
  aiText: z.string().default(''),
  metadata: voiceTurnMetadataSchema,
});

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const parsed = voiceTurnRequestSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid voice turn request' }, { status: 400 });
  }

  const { threadId, userText, aiText, metadata } = parsed.data;
  const messageMetadata = {
    source: 'voice',
    ...(metadata ? { voice: metadata } : {}),
  };

  // Verify thread belongs to the authenticated user
  const [thread] = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, authResult.user.id)))
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
      metadata: messageMetadata,
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
      metadata: messageMetadata,
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
