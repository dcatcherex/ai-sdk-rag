import { after } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { messagingApi, validateSignature } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { agent, brandAsset, lineAccountLink, lineOaChannel, lineRichMenu, lineUserAgentSession, lineUserMenu } from '@/db/schema';
import { chatModel } from '@/lib/ai';
import type { AgentRow, LinkedUser, Sender } from './types';
import { handleFollowEvent } from './events/follow';
import { handleMessageEvent, wantsImageGeneration } from './events/message';
import { handlePostbackEvent } from './events/postback';
import { handleBeaconEvent } from './events/beacon';
import { handleManagementBotEvent } from './management-bot';
import { maybeSyncUserProfile } from '@/features/line-oa/link/profile-sync';
import {
  resolveAgentBaseSystemPrompt,
  resolveAgentSkillRuntime,
} from '@/features/agents/server/runtime';

export const maxDuration = 30;

type WebhookEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string; groupId?: string };
  message?: { type: string; text?: string; id: string };
  postback?: { data: string; params?: Record<string, string> };
  beacon?: { hwid: string; type: string };
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

  // Return 200 immediately — LINE has a short timeout for webhook verification.
  // All event processing runs after the response via after().
  after(() => processEvents(body, channel));
  return new Response('OK', { status: 200 });
}

async function processEvents(
  body: { destination: string; events: WebhookEvent[] },
  channel: typeof lineOaChannel.$inferSelect,
) {
  if (body.events.length === 0) return;

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

  const systemPrompt = resolveAgentBaseSystemPrompt({ agent: agentRow });
  const modelId = agentRow?.modelId ?? chatModel;

  // ② Sender shown on every message bubble (LINE limits sender.name to 20 chars)
  const sender: Sender | undefined = agentRow?.name
    ? { name: agentRow.name.slice(0, 20), ...(brandLogoUrl ? { iconUrl: brandLogoUrl } : {}) }
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
        );
        continue;
      }

      if (event.type === 'message') {
        const lineUserId = event.source?.userId;
        const isGroupChat = event.source?.type === 'group';
        const groupId = isGroupChat ? event.source?.groupId : undefined;
        // For group chats the conversation key is the groupId; use it where lineUserId is needed for keying
        const conversationUserId = groupId ?? lineUserId;

        // Look up account link (by individual user), agent session + menu (by conversation key), and channel default menu
        const [linkRows, sessionRows, userMenuRows, defaultMenuRows] = (lineUserId || groupId)
          ? await Promise.all([
              // Account link is per individual user, even inside groups
              lineUserId
                ? db
                    .select({ userId: lineAccountLink.userId, displayName: lineAccountLink.displayName })
                    .from(lineAccountLink)
                    .where(and(eq(lineAccountLink.channelId, channel.id), eq(lineAccountLink.lineUserId, lineUserId)))
                    .limit(1)
                : Promise.resolve([]),
              // Agent session keyed by conversation (groupId for groups, lineUserId for 1:1)
              conversationUserId
                ? db
                    .select({ activeAgentId: lineUserAgentSession.activeAgentId })
                    .from(lineUserAgentSession)
                    .where(and(eq(lineUserAgentSession.channelId, channel.id), eq(lineUserAgentSession.lineUserId, conversationUserId)))
                    .limit(1)
                : Promise.resolve([]),
              // Rich menu keyed by conversation
              conversationUserId
                ? db
                    .select({ lineMenuId: lineUserMenu.lineMenuId })
                    .from(lineUserMenu)
                    .where(and(eq(lineUserMenu.channelId, channel.id), eq(lineUserMenu.lineUserId, conversationUserId)))
                    .limit(1)
                : Promise.resolve([]),
              db
                .select({ lineMenuId: lineRichMenu.lineMenuId })
                .from(lineRichMenu)
                .where(and(eq(lineRichMenu.channelId, channel.id), eq(lineRichMenu.isDefault, true)))
                .limit(1),
            ])
          : [[], [], [], []];

        const linkedUser: LinkedUser | undefined = linkRows[0] ?? undefined;

        // ── Management bot detection ─────────────────────────────────────────
        // If the sender is the channel owner (linked Vaja account === channel.userId),
        // route to the platform management bot instead of the domain agent handler.
        const isChannelOwner = linkedUser && linkedUser.userId === channel.userId;
        const ownerText = event.message?.type === 'text' ? event.message.text?.trim() ?? '' : '';
        const shouldUseDomainAgent = ownerText.length > 0 && wantsImageGeneration(ownerText);
        if (isChannelOwner && !isGroupChat && !shouldUseDomainAgent) {
          await handleManagementBotEvent(
            event,
            { id: channel.id, userId: channel.userId, name: channel.name, channelAccessToken: channel.channelAccessToken },
            lineClient,
          );
          continue;
        }

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
            effectiveSystemPrompt = resolveAgentBaseSystemPrompt({ agent: userAgent });
            effectiveModelId = userAgent.modelId ?? chatModel;
            effectiveSender = userAgent.name
              ? { name: userAgent.name.slice(0, 20) }
              : undefined;
          }
        }

        // Restore per-user/group rich menu if it differs from the channel default (fire-and-forget)
        const storedMenuId = userMenuRows[0]?.lineMenuId;
        const defaultMenuId = defaultMenuRows[0]?.lineMenuId;
        if (storedMenuId && lineUserId && storedMenuId !== defaultMenuId) {
          lineClient.linkRichMenuIdToUser(lineUserId, storedMenuId).catch((err) => {
            console.error('[LINE webhook] Failed to restore user rich menu:', err);
          });
        }

        // Refresh linked user's display name + picture if stale (24h TTL, fire-and-forget)
        if (linkedUser && lineUserId) {
          void maybeSyncUserProfile(lineUserId, channel.id, channel.channelAccessToken);
        }

        const skillRuntime = await resolveAgentSkillRuntime(
          effectiveAgentRow,
          event.message?.text ?? '',
        );

        await handleMessageEvent(
          event,
          { id: channel.id, userId: channel.userId, name: channel.name, channelAccessToken: channel.channelAccessToken, memberRichMenuLineId: channel.memberRichMenuLineId },
          lineClient,
          effectiveAgentRow,
          effectiveSender,
          effectiveSystemPrompt,
          effectiveModelId,
          linkedUser,
          skillRuntime,
          groupId,
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

      if (event.type === 'beacon') {
        await handleBeaconEvent(
          event,
          lineClient,
          { id: channel.id, channelAccessToken: channel.channelAccessToken },
          sender,
        );
      }
    } catch (eventError) {
      console.error('[LINE webhook] Error processing event:', eventError);
    }
  }
}
