/**
 * Guest chat endpoint — no auth required.
 * Credits are billed to the agent owner.
 */
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStreamResponse,
  createUIMessageStream,
} from 'ai';
import { eq, and, sql, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agent, publicAgentShare, chatThread, chatMessage } from '@/db/schema';
import { getUserBalance, deductCredits } from '@/lib/credits';
import { verifySessionToken } from '@/lib/guest-session';
import { publicAgentShareEvent } from '@/db/schema';
import { nanoid } from 'nanoid';
import { SHARED_LINK_AGENT_RUN_POLICY } from '@/features/agents/server/channel-policies';
import {
  prepareAgentRun,
  prepareCanonicalAgentImageGeneration,
  startAgentImageRun,
} from '@/features/agents/server/run-service';
import { buildAgentRunModelMessages } from '@/features/agents/server/run-helpers';
import type { AgentRunInputMessage } from '@/features/agents/server/run-types';

export const maxDuration = 30;

type Params = { params: Promise<{ token: string }> };
type SharedUiMessage = {
  id: string;
  role: AgentRunInputMessage['role'];
  parts: Array<Record<string, unknown>>;
};

export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;

    const [share] = await db
      .select()
      .from(publicAgentShare)
      .where(and(eq(publicAgentShare.shareToken, token), eq(publicAgentShare.isActive, true)))
      .limit(1);

    if (!share) {
      return Response.json({ error: 'Share link not found or disabled.' }, { status: 404 });
    }

    // ── Expiry check ──────────────────────────────────────────────────────────
    if (share.expiresAt && share.expiresAt < new Date()) {
      return Response.json({ error: 'This link has expired.' }, { status: 410 });
    }

    // ── Password check ────────────────────────────────────────────────────────
    if (share.passwordHash) {
      const guestToken = req.headers.get('x-guest-token') ?? '';
      if (!verifySessionToken(token, guestToken)) {
        return Response.json({ error: 'Password required.' }, { status: 401 });
      }
    }

    // ── Max uses check ────────────────────────────────────────────────────────
    if (share.maxUses !== null && share.conversationCount >= share.maxUses) {
      return Response.json(
        { error: 'This link has reached its maximum number of uses.' },
        { status: 429 },
      );
    }

    const [agentRow] = await db
      .select()
      .from(agent)
      .where(eq(agent.id, share.agentId))
      .limit(1);

    if (!agentRow) {
      return Response.json({ error: 'Agent not found.' }, { status: 404 });
    }

    const body = await req.json() as { messages: unknown[] };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }
    const messages = body.messages as AgentRunInputMessage[];
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }
    const uiMessages: SharedUiMessage[] = messages.map((message, index) => ({
      id: `incoming-${index}`,
      role: message.role,
      parts:
        (message.parts as Array<Record<string, unknown>> | undefined) ??
        [{ type: 'text', text: message.content }],
    }));

    // ── Per-session message limit ─────────────────────────────────────────────
    if (share.guestMessageLimit !== null) {
      const userMsgCount = messages.filter((message) => message.role === 'user').length;
      if (userMsgCount > share.guestMessageLimit) {
        return Response.json(
          { error: `You've reached the ${share.guestMessageLimit}-message limit for this session.` },
          { status: 429 },
        );
      }
    }

    // ── Find or create per-device thread ─────────────────────────────────────
    const guestId = req.headers.get('x-guest-id') ?? null;
    let threadId: string | null = null;
    if (guestId) {
      const [existing] = await db
        .select({ id: chatThread.id })
        .from(chatThread)
        .where(and(eq(chatThread.shareToken, token), eq(chatThread.guestId, guestId)))
        .limit(1);
      if (existing) {
        threadId = existing.id;
      } else {
        const newId = nanoid();
        await db.insert(chatThread).values({
          id: newId,
          title: 'Guest chat',
          preview: '',
          shareToken: token,
          guestId,
          agentId: agentRow.id,
        }).onConflictDoNothing();
        // In case of a race, fetch the winner
        const [created] = await db
          .select({ id: chatThread.id })
          .from(chatThread)
          .where(and(eq(chatThread.shareToken, token), eq(chatThread.guestId, guestId)))
          .limit(1);
        threadId = created?.id ?? null;
      }
    }

    if (!agentRow.userId) {
      return Response.json({ error: 'Agent not available.' }, { status: 400 });
    }
    const ownerId = agentRow.userId;

    let prepared;
    try {
      prepared = await prepareAgentRun({
        identity: {
          channel: 'shared_link',
          userId: null,
          billingUserId: ownerId,
          guestId,
        },
        threadId: threadId ?? nanoid(),
        agentId: agentRow.id,
        messages,
        policy: SHARED_LINK_AGENT_RUN_POLICY,
      });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Unable to prepare shared agent run.' },
        { status: 409 },
      );
    }

    const imagePreflight =
      prepared.lastUserPrompt && SHARED_LINK_AGENT_RUN_POLICY.allowDirectImageGeneration
        ? await prepareCanonicalAgentImageGeneration({
            prompt: prepared.lastUserPrompt,
            activeBrand: prepared.activeBrand,
            source: 'shared_link',
          })
        : null;
    const creditCost = imagePreflight?.creditCost ?? prepared.creditCost;

    // ── Credit limit check (link budget) ──────────────────────────────────────
    if (share.creditLimit !== null && share.creditsUsed + creditCost > share.creditLimit) {
      return Response.json(
        { error: 'This link has reached its credit budget.' },
        { status: 402 },
      );
    }

    // ── Owner balance check ────────────────────────────────────────────────────
    const ownerBalance = await getUserBalance(ownerId);
    if (ownerBalance < creditCost) {
      return Response.json(
        { error: 'This agent is temporarily unavailable (owner has insufficient credits).' },
        { status: 402 },
      );
    }

    const sessionId = req.headers.get('x-session-id') ?? undefined;
    const isFirstMessage = messages.filter((m) => m.role === 'user').length === 1;
    if (isFirstMessage) {
      const firstUserMsg = messages.find((m) => m.role === 'user');
      const firstText =
        firstUserMsg?.parts?.find((part) =>
          Boolean(
            part &&
            typeof part === 'object' &&
            'type' in part &&
            'text' in part &&
            (part as { type?: unknown }).type === 'text' &&
            typeof (part as { text?: unknown }).text === 'string',
          ),
        ) as { text?: string } | undefined;
      void db.insert(publicAgentShareEvent).values({
        id: nanoid(),
        shareToken: token,
        eventType: 'chat',
        sessionId: sessionId ?? null,
        firstMessage: firstText?.text ? firstText.text.slice(0, 200) : null,
      });
    }

    if (imagePreflight) {
      const imageRun = await startAgentImageRun(prepared);
      const toolCallId = nanoid();

      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          originalMessages: uiMessages as never,
          onFinish: async ({ messages: updatedMessages }) => {
            if (!threadId) return;
            try {
              type UIMsg = { id?: string; role: string; parts: unknown[] };
              await db.delete(chatMessage).where(eq(chatMessage.threadId, threadId));
              await db.insert(chatMessage).values(
                (updatedMessages as UIMsg[]).map((msg, i) => ({
                  id: msg.id || nanoid(),
                  threadId,
                  role: msg.role,
                  parts: msg.parts,
                  position: i,
                })),
              );
              await db.update(chatThread).set({
                preview: imageRun.prompt.slice(0, 120),
                updatedAt: new Date(),
              }).where(eq(chatThread.id, threadId));
              await deductCredits({
                userId: ownerId,
                amount: creditCost,
                description: `Guest chat on shared agent "${agentRow.name}" (token: ${token})`,
              });
              await db
                .update(publicAgentShare)
                .set({
                  conversationCount: sql`${publicAgentShare.conversationCount} + 1`,
                  creditsUsed: sql`${publicAgentShare.creditsUsed} + ${creditCost}`,
                })
                .where(eq(publicAgentShare.shareToken, token));
            } catch (e) {
              console.error('[guest-chat] finalize image run error', e);
            }
          },
          execute: ({ writer }) => {
            writer.write({ type: 'start' });
            writer.write({ type: 'start-step' });
            writer.write({
              type: 'tool-input-available',
              toolCallId,
              toolName: 'generate_image',
              input: { prompt: imageRun.prompt, modelId: imageRun.modelId },
            });
            writer.write({
              type: 'tool-output-available',
              toolCallId,
              output: {
                started: true,
                status: 'processing' as const,
                taskId: imageRun.taskId,
                generationId: imageRun.generationId,
                message: 'Image generation started. The image will appear in this chat when it is ready.',
              },
            });
            writer.write({ type: 'finish-step' });
            writer.write({ type: 'finish', finishReason: 'stop' });
          },
        }),
      });
    }

    const result = streamText({
      model: prepared.modelId,
      system: prepared.systemPrompt,
      messages: await convertToModelMessages(
        buildAgentRunModelMessages(prepared.request.messages) as Parameters<typeof convertToModelMessages>[0],
      ),
      stopWhen: stepCountIs(prepared.request.policy.maxSteps),
      ...(prepared.supportsTools && prepared.tools ? { tools: prepared.tools } : {}),
      onFinish: async ({ text }) => {
        if (!threadId) return;
        try {
          const allMessages = [
            ...uiMessages,
            { id: nanoid(), role: 'assistant', parts: [{ type: 'text', text }] },
          ];
          await db.delete(chatMessage).where(eq(chatMessage.threadId, threadId));
          await db.insert(chatMessage).values(
            allMessages.map((msg, i) => ({
              id: (msg.id as string | undefined) || nanoid(),
              threadId: threadId!,
              role: msg.role,
              parts: msg.parts,
              position: i,
            })),
          );
          const preview = text.slice(0, 120);
          await db.update(chatThread).set({ preview, updatedAt: new Date() }).where(eq(chatThread.id, threadId));
        } catch (e) {
          console.error('[guest-chat] persist messages error', e);
        }
      },
    });

    // ── Record analytics event (fire and forget) ─────────────────────────────
    void (async () => {
      try {
        await result.consumeStream();
        await deductCredits({
          userId: ownerId,
          amount: creditCost,
          description: `Guest chat on shared agent "${agentRow.name}" (token: ${token})`,
        });
        await db
          .update(publicAgentShare)
          .set({
            conversationCount: sql`${publicAgentShare.conversationCount} + 1`,
            creditsUsed: sql`${publicAgentShare.creditsUsed} + ${creditCost}`,
          })
          .where(eq(publicAgentShare.shareToken, token));
      } catch (err) {
        console.error('[guest-chat] post-stream error', err);
      }
    })();

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: ({ writer }) => {
          writer.merge(result.toUIMessageStream());
        },
      }),
    });
  } catch (err) {
    console.error('[guest-chat]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
