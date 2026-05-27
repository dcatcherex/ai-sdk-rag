import { and, asc, count, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { chatMessage, chatThread, publicAgentShare } from '@/db/schema';
import { buildVoiceTurnAssistantArtifacts } from '@/features/chat/server/voice-turn-artifacts';
import { resolveTaskFlowRuntime } from '@/features/task-flows/server/runtime';
import type { ChatMessage } from '@/features/chat/types';
import {
  assertPublicAgentThread,
  resolvePublicAgentShare,
} from '@/features/agents/server/public-realtime-voice';

type Params = { params: Promise<{ token: string }> };

const publicVoiceTurnMetadataSchema = z.object({
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
    output: z.unknown().optional(),
  })).max(50).optional(),
}).optional();

const publicVoiceTurnRequestSchema = z.object({
  threadId: z.string().min(1),
  userText: z.string().default(''),
  aiText: z.string().default(''),
  metadata: publicVoiceTurnMetadataSchema,
});

export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const parsed = publicVoiceTurnRequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return Response.json({ error: 'Invalid voice turn request' }, { status: 400 });
    }

    const { threadId, userText, aiText, metadata } = parsed.data;
    if (!userText.trim() && !aiText.trim()) {
      return Response.json({ ok: true });
    }

    const publicContext = await resolvePublicAgentShare(req, token);
    await assertPublicAgentThread({
      token,
      guestId: publicContext.guestId,
      threadId,
    });

    if (publicContext.share.guestMessageLimit !== null && userText.trim()) {
      const [{ value: userMessageCount }] = await db
        .select({ value: count() })
        .from(chatMessage)
        .where(and(eq(chatMessage.threadId, threadId), eq(chatMessage.role, 'user')));

      if (userMessageCount >= publicContext.share.guestMessageLimit) {
        return Response.json(
          { error: `You've reached the ${publicContext.share.guestMessageLimit}-message limit for this session.` },
          { status: 429 },
        );
      }
    }

    const [{ value: existingCount }] = await db
      .select({ value: count() })
      .from(chatMessage)
      .where(eq(chatMessage.threadId, threadId));
    const existingMessages = await db
      .select({ id: chatMessage.id, role: chatMessage.role, parts: chatMessage.parts, metadata: chatMessage.metadata })
      .from(chatMessage)
      .where(eq(chatMessage.threadId, threadId))
      .orderBy(asc(chatMessage.position));
    const taskFlowRuntime = await resolveTaskFlowRuntime({
      channel: 'shared_link',
      lastUserPrompt: userText.trim(),
      messages: existingMessages as ChatMessage[],
      activeSkillIds: Array.isArray(publicContext.agent.skillIds)
        ? publicContext.agent.skillIds.filter((value): value is string => typeof value === 'string')
        : [],
      activeSkillNames: [],
    });

    const now = new Date();
    let nextPosition = existingCount;
    const userMessageMetadata = {
      source: 'voice',
      ...(metadata ? { voice: metadata } : {}),
    };
    const messagesToInsert = [];

    if (userText.trim()) {
      messagesToInsert.push({
        id: crypto.randomUUID(),
        threadId,
        role: 'user' as const,
        parts: [{ type: 'text', text: userText.trim() }],
        metadata: userMessageMetadata,
        position: nextPosition++,
        createdAt: now,
      });
    }

    if (aiText.trim()) {
      const assistantArtifacts = await buildVoiceTurnAssistantArtifacts({
        aiText: aiText.trim(),
        userText: userText.trim(),
        metadata,
        taskFlowDecision: taskFlowRuntime.decision,
      });
      messagesToInsert.push({
        id: crypto.randomUUID(),
        threadId,
        role: 'assistant' as const,
        parts: assistantArtifacts.parts,
        metadata: assistantArtifacts.metadata,
        position: nextPosition++,
        createdAt: now,
      });
    }

    if (messagesToInsert.length > 0) {
      await db.insert(chatMessage).values(messagesToInsert);
    }

    const preview = (aiText.trim() || userText.trim()).slice(0, 100);
    await Promise.all([
      db
        .update(chatThread)
        .set({ preview, updatedAt: now })
        .where(eq(chatThread.id, threadId)),
      db
        .update(publicAgentShare)
        .set({ conversationCount: sql`${publicAgentShare.conversationCount} + 1` })
        .where(eq(publicAgentShare.shareToken, token)),
    ]);

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Password required.' ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
