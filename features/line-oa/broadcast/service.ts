import { and, desc, eq } from 'drizzle-orm';
import { messagingApi, manageAudience } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { lineBroadcast, lineOaChannel, lineAudience, lineAudienceUser } from '@/db/schema';

type BroadcastRow = typeof lineBroadcast.$inferSelect;

/** Exponential backoff retry for transient LINE API failures (429 / 5xx). */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { statusCode?: number; status?: number })?.statusCode
        ?? (err as { statusCode?: number; status?: number })?.status;
      const isTransient = status === 429 || (status !== undefined && status >= 500);
      if (!isTransient || attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw lastError;
}

/**
 * Load a broadcast + its channel, verifying ownership.
 */
async function loadBroadcastWithChannel(broadcastId: string, userId: string) {
  const rows = await db
    .select({
      broadcast: lineBroadcast,
      accessToken: lineOaChannel.channelAccessToken,
      channelUserId: lineOaChannel.userId,
    })
    .from(lineBroadcast)
    .innerJoin(lineOaChannel, eq(lineBroadcast.channelId, lineOaChannel.id))
    .where(eq(lineBroadcast.id, broadcastId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error('Broadcast not found');
  if (row.channelUserId !== userId) throw new Error('Unauthorized');
  return row;
}

/**
 * List broadcasts for a channel (most recent first).
 */
export async function listBroadcasts(
  channelId: string,
  userId: string,
): Promise<BroadcastRow[]> {
  // Verify channel ownership
  const channelRows = await db
    .select({ id: lineOaChannel.id })
    .from(lineOaChannel)
    .where(and(eq(lineOaChannel.id, channelId), eq(lineOaChannel.userId, userId)))
    .limit(1);

  if (!channelRows[0]) throw new Error('Channel not found');

  const rows = await db
    .select()
    .from(lineBroadcast)
    .where(eq(lineBroadcast.channelId, channelId))
    .orderBy(desc(lineBroadcast.createdAt));

  return rows;
}

/**
 * Create a new broadcast in draft state.
 */
export async function createBroadcast(
  channelId: string,
  userId: string,
  input: { name: string; messageText?: string; messageType?: 'text' | 'flex'; messagePayload?: Record<string, unknown> },
): Promise<BroadcastRow> {
  // Verify channel ownership
  const channelRows = await db
    .select({ id: lineOaChannel.id })
    .from(lineOaChannel)
    .where(and(eq(lineOaChannel.id, channelId), eq(lineOaChannel.userId, userId)))
    .limit(1);

  if (!channelRows[0]) throw new Error('Channel not found');

  const now = new Date();
  const id = crypto.randomUUID();

  await db.insert(lineBroadcast).values({
    id,
    channelId,
    name: input.name,
    targetType: 'all',
    messageType: input.messageType ?? 'text',
    messageText: input.messageText ?? null,
    messagePayload: input.messagePayload ?? null,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  });

  const rows = await db
    .select()
    .from(lineBroadcast)
    .where(eq(lineBroadcast.id, id))
    .limit(1);

  return rows[0]!;
}

/**
 * Update a broadcast (name, message text, or flex payload). Resets to draft status.
 */
export async function updateBroadcast(
  broadcastId: string,
  userId: string,
  input: { name?: string; messageText?: string; messagePayload?: Record<string, unknown>; messageType?: 'text' | 'flex' },
): Promise<void> {
  const { broadcast, channelUserId } = await loadBroadcastWithChannel(broadcastId, userId);
  if (channelUserId !== userId) throw new Error('Unauthorized');

  await db
    .update(lineBroadcast)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.messageText !== undefined && { messageText: input.messageText }),
      ...(input.messagePayload !== undefined && { messagePayload: input.messagePayload }),
      ...(input.messageType !== undefined && { messageType: input.messageType }),
      status: 'draft',
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(lineBroadcast.id, broadcast.id));
}

/**
 * Delete a broadcast (only drafts or failed).
 */
export async function deleteBroadcast(
  broadcastId: string,
  userId: string,
): Promise<void> {
  await loadBroadcastWithChannel(broadcastId, userId);
  await db.delete(lineBroadcast).where(eq(lineBroadcast.id, broadcastId));
}

/**
 * Send a broadcast to all followers via LINE Broadcast API.
 */
export async function sendBroadcast(
  broadcastId: string,
  userId: string,
): Promise<{ recipientCount: number | null }> {
  const { broadcast, accessToken } = await loadBroadcastWithChannel(broadcastId, userId);

  if (broadcast.messageType === 'flex') {
    if (!broadcast.messagePayload) throw new Error('Flex broadcast has no message payload');
  } else {
    if (!broadcast.messageText) throw new Error('Broadcast has no message text');
  }

  // Mark as sending
  await db
    .update(lineBroadcast)
    .set({ status: 'sending', updatedAt: new Date() })
    .where(eq(lineBroadcast.id, broadcastId));

  const aggregationUnit = broadcastId.replace(/-/g, '').slice(0, 30);

  await db
    .update(lineBroadcast)
    .set({ customAggregationUnit: aggregationUnit, updatedAt: new Date() })
    .where(eq(lineBroadcast.id, broadcastId));

  const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: accessToken });

  const messageBody =
    broadcast.messageType === 'flex'
      ? {
          type: 'flex' as const,
          altText: String((broadcast.messagePayload as Record<string, unknown>).altText ?? broadcast.name),
          contents: (broadcast.messagePayload as Record<string, unknown>).contents ?? broadcast.messagePayload,
        }
      : { type: 'text' as const, text: broadcast.messageText! };

  try {
    const broadcastRequest = {
      messages: [messageBody],
      customAggregationUnits: [aggregationUnit],
    };
    const result = await withRetry(() =>
      lineClient.broadcast(broadcastRequest as Parameters<typeof lineClient.broadcast>[0]),
    );

    // broadcastResponse may include requestId in headers; recipient count not in body for broadcast
    const recipientCount = (result as { sentMessages?: { customAggregationUnits?: string[] } })
      ?.sentMessages?.customAggregationUnits?.length ?? null;

    await db
      .update(lineBroadcast)
      .set({
        status: 'sent',
        sentAt: new Date(),
        recipientCount: typeof recipientCount === 'number' ? recipientCount : null,
        customAggregationUnit: aggregationUnit,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(lineBroadcast.id, broadcastId));

    return { recipientCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(lineBroadcast)
      .set({ status: 'failed', errorMessage: message, updatedAt: new Date() })
      .where(eq(lineBroadcast.id, broadcastId));
    throw err;
  }
}

export type BroadcastStats = {
  customAggregationUnit: string | null;
  delivered: number;
  uniqueImpression: number;
  uniqueClick: number;
  uniqueMediaPlayed: number;
  uniqueMediaPlayed100Percent: number;
  from: string;
  to: string;
};

export async function getBroadcastStats(
  broadcastId: string,
  userId: string,
): Promise<BroadcastStats | null> {
  const { broadcast, accessToken } = await loadBroadcastWithChannel(broadcastId, userId);

  if (!broadcast.customAggregationUnit || !broadcast.sentAt) return null;

  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const from = fmt(broadcast.sentAt);
  const to = fmt(new Date(broadcast.sentAt.getTime() + 86_400_000)); // +1 day

  const url = `https://api.line.me/v2/bot/insight/message/event/aggregation`
    + `?customAggregationUnit=${encodeURIComponent(broadcast.customAggregationUnit)}&from=${from}&to=${to}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`LINE insight API error: ${res.status}`);
  }

  const data = await res.json() as {
    overview?: {
      delivered?: number;
      uniqueImpression?: number;
      uniqueClick?: number;
      uniqueMediaPlayed?: number;
      uniqueMediaPlayed100Percent?: number;
    };
  };

  const ov = data.overview ?? {};
  return {
    customAggregationUnit: broadcast.customAggregationUnit,
    delivered: ov.delivered ?? 0,
    uniqueImpression: ov.uniqueImpression ?? 0,
    uniqueClick: ov.uniqueClick ?? 0,
    uniqueMediaPlayed: ov.uniqueMediaPlayed ?? 0,
    uniqueMediaPlayed100Percent: ov.uniqueMediaPlayed100Percent ?? 0,
    from,
    to,
  };
}

export type AudienceRow = typeof lineAudience.$inferSelect;

export async function createAudience(
  channelId: string,
  userId: string,
  input: { name: string; lineUserIds: string[] },
): Promise<AudienceRow> {
  const channelRows = await db
    .select({ id: lineOaChannel.id, channelAccessToken: lineOaChannel.channelAccessToken })
    .from(lineOaChannel)
    .where(and(eq(lineOaChannel.id, channelId), eq(lineOaChannel.userId, userId)))
    .limit(1);

  const channel = channelRows[0];
  if (!channel) throw new Error('Channel not found');

  const audienceClient = new manageAudience.ManageAudienceClient({
    channelAccessToken: channel.channelAccessToken,
  });

  const lineResult = await audienceClient.createAudienceGroup({
    description: input.name,
    isIfaAudience: false,
    audiences: input.lineUserIds.map((id) => ({ id })),
  });

  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(lineAudience).values({
    id,
    channelId,
    name: input.name,
    lineAudienceGroupId: String(lineResult.audienceGroupId),
    audienceCount: input.lineUserIds.length,
    status: 'ready',
    createdAt: now,
    updatedAt: now,
  });

  // Persist individual users
  if (input.lineUserIds.length > 0) {
    await db.insert(lineAudienceUser).values(
      input.lineUserIds.map((lineUserId) => ({
        id: crypto.randomUUID(),
        audienceId: id,
        lineUserId,
        createdAt: now,
      })),
    );
  }

  const rows = await db.select().from(lineAudience).where(eq(lineAudience.id, id)).limit(1);
  return rows[0]!;
}

export async function sendNarrowcast(
  channelId: string,
  userId: string,
  input: { audienceId: string; messageText: string },
): Promise<void> {
  const channelRows = await db
    .select({ id: lineOaChannel.id, channelAccessToken: lineOaChannel.channelAccessToken })
    .from(lineOaChannel)
    .where(and(eq(lineOaChannel.id, channelId), eq(lineOaChannel.userId, userId)))
    .limit(1);

  const channel = channelRows[0];
  if (!channel) throw new Error('Channel not found');

  const audienceRows = await db
    .select({ lineAudienceGroupId: lineAudience.lineAudienceGroupId })
    .from(lineAudience)
    .where(and(eq(lineAudience.id, input.audienceId), eq(lineAudience.channelId, channelId)))
    .limit(1);

  const audience = audienceRows[0];
  if (!audience?.lineAudienceGroupId) throw new Error('Audience not found or not ready');

  const lineClient = new messagingApi.MessagingApiClient({
    channelAccessToken: channel.channelAccessToken,
  });

  await withRetry(() =>
    lineClient.narrowcast({
      messages: [{ type: 'text', text: input.messageText }],
      recipient: {
        type: 'audience',
        audienceGroupId: Number(audience.lineAudienceGroupId),
      },
    }),
  );
}
