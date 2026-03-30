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
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agent, publicAgentShare } from '@/db/schema';
import { getCreditCost, getUserBalance, deductCredits } from '@/lib/credits';
import { availableModels, chatModel, maxSteps } from '@/lib/ai';
import { toolDisabledModels } from '@/features/chat/server/routing';
import { createAgentTools } from '@/lib/agent-tools';
import { verifySessionToken } from '@/lib/guest-session';
import { publicAgentShareEvent } from '@/db/schema';
import { nanoid } from 'nanoid';

export const maxDuration = 30;

type Params = { params: Promise<{ token: string }> };

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
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }

    // ── Per-session message limit ─────────────────────────────────────────────
    if (share.guestMessageLimit !== null) {
      const userMsgCount = messages.filter(
        (m): m is { role: string } => typeof m === 'object' && m !== null && (m as { role?: string }).role === 'user'
      ).length;
      if (userMsgCount > share.guestMessageLimit) {
        return Response.json(
          { error: `You've reached the ${share.guestMessageLimit}-message limit for this session.` },
          { status: 429 },
        );
      }
    }

    const resolvedModel = agentRow.modelId && availableModels.some((m) => m.id === agentRow.modelId)
      ? agentRow.modelId
      : chatModel;

    const ownerId = agentRow.userId;
    const creditCost = getCreditCost(resolvedModel);

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

    const supportsTools = !toolDisabledModels.has(resolvedModel);
    const agentTools = supportsTools && agentRow.enabledTools.length > 0
      ? createAgentTools(
          agentRow.enabledTools,
          ownerId,
          agentRow.documentIds.length > 0 ? agentRow.documentIds : undefined,
        )
      : undefined;

    const systemPrompt = agentRow.systemPrompt +
      (agentRow.documentIds.length > 0
        ? '\nIMPORTANT: Use the searchKnowledge tool to find relevant information before answering.'
        : '');

    const result = streamText({
      model: resolvedModel,
      system: systemPrompt,
      messages: await convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0]),
      stopWhen: stepCountIs(maxSteps),
      ...(agentTools ? { tools: agentTools } : {}),
    });

    // ── Record analytics event (fire and forget) ─────────────────────────────
    const sessionId = req.headers.get('x-session-id') ?? undefined;
    const isFirstMessage = (messages as Array<{ role?: string }>)
      .filter((m) => m.role === 'user').length === 1;
    if (isFirstMessage) {
      const firstUserMsg = (messages as Array<{ role?: string; parts?: Array<{ type: string; text?: string }> }>)
        .find((m) => m.role === 'user');
      const firstText = firstUserMsg?.parts?.find((p) => p.type === 'text')?.text ?? null;
      void db.insert(publicAgentShareEvent).values({
        id: nanoid(),
        shareToken: token,
        eventType: 'chat',
        sessionId: sessionId ?? null,
        firstMessage: firstText ? firstText.slice(0, 200) : null,
      });
    }

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
