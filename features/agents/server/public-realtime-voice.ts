import 'server-only';

import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { db } from '@/lib/db';
import { agent, chatThread, publicAgentShare } from '@/db/schema';
import { verifySessionToken } from '@/lib/guest-session';
import { SHARED_LINK_AGENT_RUN_POLICY } from '@/features/agents/server/channel-policies';
import { prepareConversationTurn } from '@/features/agents/server/conversation-turn';
import {
  buildVoiceRunMessages,
  realtimeVoiceContextSchema,
  WAIT_FOR_USER_TOOL_NAME,
  type RealtimeVoiceContextInput,
} from '@/features/chat/server/realtime-voice';

export const publicRealtimeSessionRequestSchema = realtimeVoiceContextSchema.extend({
  sdp: z.string().min(1),
});

export const publicRealtimeToolCallSchema = z.object({
  context: realtimeVoiceContextSchema,
  callId: z.string().min(1),
  toolName: z.string().min(1),
  argumentsJson: z.string().default('{}'),
});

export type PublicRealtimeRunContext = Awaited<ReturnType<typeof preparePublicRealtimeVoiceRun>>;

export async function resolvePublicAgentShare(req: Request, token: string) {
  const guestId = req.headers.get('x-guest-id');
  if (!guestId) {
    throw new Error('Guest session is required.');
  }

  const [share] = await db
    .select()
    .from(publicAgentShare)
    .where(and(eq(publicAgentShare.shareToken, token), eq(publicAgentShare.isActive, true)))
    .limit(1);

  if (!share) {
    throw new Error('Share link not found or disabled.');
  }

  if (share.expiresAt && share.expiresAt < new Date()) {
    throw new Error('This link has expired.');
  }

  if (share.maxUses !== null && share.conversationCount >= share.maxUses) {
    throw new Error('This link has reached its maximum number of uses.');
  }

  if (share.passwordHash) {
    const guestToken = req.headers.get('x-guest-token') ?? '';
    if (!verifySessionToken(token, guestToken)) {
      throw new Error('Password required.');
    }
  }

  const [agentRow] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, share.agentId))
    .limit(1);

  if (!agentRow?.userId) {
    throw new Error('Agent not available.');
  }

  return {
    share,
    agent: agentRow,
    ownerId: agentRow.userId,
    guestId,
  };
}

export async function ensurePublicAgentThread(input: {
  token: string;
  guestId: string;
  agentId: string;
}) {
  const [existing] = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(and(eq(chatThread.shareToken, input.token), eq(chatThread.guestId, input.guestId)))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const newId = nanoid();
  await db.insert(chatThread).values({
    id: newId,
    title: 'Guest chat',
    preview: '',
    shareToken: input.token,
    guestId: input.guestId,
    agentId: input.agentId,
  }).onConflictDoNothing();

  const [created] = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(and(eq(chatThread.shareToken, input.token), eq(chatThread.guestId, input.guestId)))
    .limit(1);

  if (!created) {
    throw new Error('Unable to create guest thread.');
  }

  return created.id;
}

export async function assertPublicAgentThread(input: {
  token: string;
  guestId: string;
  threadId: string;
}) {
  const [thread] = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(
      and(
        eq(chatThread.id, input.threadId),
        eq(chatThread.shareToken, input.token),
        eq(chatThread.guestId, input.guestId),
      ),
    )
    .limit(1);

  if (!thread) {
    throw new Error('Thread not found.');
  }
}

export async function preparePublicRealtimeVoiceRun(input: {
  req: Request;
  token: string;
  context: RealtimeVoiceContextInput;
}) {
  const publicContext = await resolvePublicAgentShare(input.req, input.token);

  await assertPublicAgentThread({
    token: input.token,
    guestId: publicContext.guestId,
    threadId: input.context.threadId,
  });

  const turn = await prepareConversationTurn({
    request: {
      identity: {
        channel: 'shared_link',
        userId: null,
        billingUserId: publicContext.ownerId,
        guestId: publicContext.guestId,
      },
      threadId: input.context.threadId,
      agentId: publicContext.agent.id,
      messages: buildVoiceRunMessages(input.context.history),
      model: input.context.model ?? null,
      enabledModelIds: input.context.enabledModelIds,
      selectedDocumentIds: input.context.selectedDocumentIds,
      useWebSearch: input.context.useWebSearch,
      policy: SHARED_LINK_AGENT_RUN_POLICY,
    },
  });

  return {
    ...publicContext,
    turn,
  };
}

export async function executePublicRealtimeToolCall(input: {
  runContext: PublicRealtimeRunContext;
  context: RealtimeVoiceContextInput;
  toolName: string;
  callId: string;
  argumentsJson: string;
  signal?: AbortSignal;
}) {
  if (input.toolName === WAIT_FOR_USER_TOOL_NAME) {
    return { ok: true };
  }

  const tool = input.runContext.turn.preparedRun.tools?.[input.toolName];
  if (!tool || typeof tool.execute !== 'function') {
    throw new Error(`Tool not available: ${input.toolName}`);
  }

  const parsedArguments = input.argumentsJson.trim()
    ? JSON.parse(input.argumentsJson)
    : {};

  const result = await tool.execute(parsedArguments, {
    toolCallId: input.callId,
    messages: [],
    abortSignal: input.signal,
    experimental_context: {
      userId: input.runContext.ownerId,
      threadId: input.context.threadId,
      source: 'realtime_voice',
    },
  });

  if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
    let finalOutput: unknown;
    for await (const chunk of result as AsyncIterable<unknown>) {
      finalOutput = chunk;
    }
    return finalOutput;
  }

  return result;
}
