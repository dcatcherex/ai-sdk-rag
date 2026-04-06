import { and, eq } from 'drizzle-orm';
import { messagingApi, validateSignature } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { agent, brandAsset, lineAccountLink, lineOaChannel, lineUserAgentSession } from '@/db/schema';
import { chatModel } from '@/lib/ai';
import { getSystemPrompt } from '@/lib/prompt';
import type { AgentRow, LinkedUser, Sender } from './types';
import { handleFollowEvent } from './events/follow';
import { handleMessageEvent } from './events/message';
import { handlePostbackEvent } from './events/postback';
import {
  getSkillsForAgent,
  resolveSkillRuntimeContext,
} from '@/features/skills/service';

export const maxDuration = 30;

type WebhookEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string; id: string };
  postback?: { data: string; params?: Record<string, string> };
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;

  // 1. Read raw body (must not be modified before signature verification)
  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  // 2. Look up channel record
  const channelRows = await db
    .select()
    .from(lineOaChannel)
    .where(eq(lineOaChannel.id, channelId))
    .limit(1);

  if (channelRows.length === 0 || channelRows[0]!.status !== 'active') {
    return new Response('OK', { status: 200 });
  }

  const channel = channelRows[0]!;

  // 3. Verify signature (HMAC-SHA256)
  if (!validateSignature(rawBody, channel.channelSecret, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  // 4. Parse body
  const body = JSON.parse(rawBody) as {
    destination: string;
    events: WebhookEvent[];
  };

  // 5. Load agent config, then brand logo sequentially (logo depends on agentId)
  const agentRow: AgentRow = channel.agentId
    ? ((await db.select().from(agent).where(eq(agent.id, channel.agentId)).limit(1))[0] as AgentRow) ?? null
    : null;

  const brandLogoUrl: string | undefined = agentRow?.brandId
    ? (
        await db
          .select({ url: brandAsset.url })
          .from(brandAsset)
          .where(and(eq(brandAsset.brandId, agentRow.brandId), eq(brandAsset.kind, 'logo')))
          .limit(1)
      )[0]?.url ?? undefined
    : undefined;

  const systemPrompt = agentRow?.systemPrompt ?? getSystemPrompt('general_assistant');
  const modelId = agentRow?.modelId ?? chatModel;

  // ② Sender shown on every message bubble
  const sender: Sender | undefined = agentRow?.name
    ? { name: agentRow.name, ...(brandLogoUrl ? { iconUrl: brandLogoUrl } : {}) }
    : undefined;

  // 6. Initialise LINE client
  const lineClient = new messagingApi.MessagingApiClient({
    channelAccessToken: channel.channelAccessToken,
  });

  // 7. Route each event to its handler
  for (const event of body.events) {
    try {
      if (event.type === 'follow' && event.replyToken) {
        await handleFollowEvent(
          { replyToken: event.replyToken },
          lineClient,
          agentRow,
          brandLogoUrl,
          sender,
          agentRow?.starterPrompts ?? [],
        );
        continue;
      }

      if (event.type === 'message') {
        const lineUserId = event.source?.userId;

        // Look up account link + active agent session in parallel
        const [linkRows, sessionRows] = lineUserId
          ? await Promise.all([
              db
                .select({ userId: lineAccountLink.userId, displayName: lineAccountLink.displayName })
                .from(lineAccountLink)
                .where(and(eq(lineAccountLink.channelId, channel.id), eq(lineAccountLink.lineUserId, lineUserId)))
                .limit(1),
              db
                .select({ activeAgentId: lineUserAgentSession.activeAgentId })
                .from(lineUserAgentSession)
                .where(and(eq(lineUserAgentSession.channelId, channel.id), eq(lineUserAgentSession.lineUserId, lineUserId)))
                .limit(1),
            ])
          : [[], []];

        const linkedUser: LinkedUser | undefined = linkRows[0] ?? undefined;

        // Resolve the effective agent: user's active choice > channel default
        const activeAgentId = sessionRows[0]?.activeAgentId ?? null;
        let effectiveAgentRow = agentRow;
        let effectiveSystemPrompt = systemPrompt;
        let effectiveModelId = modelId;
        let effectiveSender = sender;

        if (activeAgentId && activeAgentId !== channel.agentId) {
          const [userAgent] = await db.select().from(agent).where(eq(agent.id, activeAgentId)).limit(1);
          if (userAgent) {
            effectiveAgentRow = userAgent as AgentRow;
            effectiveSystemPrompt = userAgent.systemPrompt ?? getSystemPrompt('general_assistant');
            effectiveModelId = userAgent.modelId ?? chatModel;
            effectiveSender = userAgent.name
              ? { name: userAgent.name }
              : undefined;
          }
        }

        // Inject skills into the system prompt (mirrors app/api/chat/route.ts skill injection)
        if (effectiveAgentRow?.id) {
          const userText = event.message?.text ?? '';
          const agentSkillRows = await getSkillsForAgent(
            effectiveAgentRow.id,
            effectiveAgentRow.skillIds ?? [],
          );

          if (agentSkillRows.length > 0) {
            const skillRuntime = await resolveSkillRuntimeContext(agentSkillRows, userText);
            effectiveSystemPrompt += skillRuntime.catalogBlock;
            effectiveSystemPrompt += skillRuntime.activeSkillsBlock;
            effectiveSystemPrompt += skillRuntime.skillResourcesBlock;
          }
        }

        await handleMessageEvent(
          event,
          { id: channel.id, userId: channel.userId, name: channel.name, channelAccessToken: channel.channelAccessToken },
          lineClient,
          effectiveAgentRow,
          effectiveSender,
          effectiveSystemPrompt,
          effectiveModelId,
          linkedUser,
        );
      }

      if (event.type === 'postback') {
        await handlePostbackEvent(
          event,
          lineClient,
          channel.id,
          channel.channelAccessToken,
        );
      }
    } catch (eventError) {
      console.error('[LINE webhook] Error processing event:', eventError);
    }
  }

  return new Response('OK', { status: 200 });
}
