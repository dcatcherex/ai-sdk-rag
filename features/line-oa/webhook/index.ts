import { and, eq } from 'drizzle-orm';
import { messagingApi, validateSignature } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { agent, brandAsset, lineOaChannel } from '@/db/schema';
import { chatModel } from '@/lib/ai';
import { getSystemPrompt } from '@/lib/prompt';
import type { AgentRow, Sender } from './types';
import { handleFollowEvent } from './events/follow';
import { handleMessageEvent } from './events/message';
import { handlePostbackEvent } from './events/postback';

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
        );
        continue;
      }

      if (event.type === 'message') {
        await handleMessageEvent(
          event,
          { id: channel.id, userId: channel.userId, name: channel.name },
          lineClient,
          agentRow,
          sender,
          systemPrompt,
          modelId,
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
