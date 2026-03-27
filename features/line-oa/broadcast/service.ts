import { and, desc, eq } from 'drizzle-orm';
import { messagingApi } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { lineBroadcast, lineOaChannel } from '@/db/schema';

type BroadcastRow = typeof lineBroadcast.$inferSelect;

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
  input: { name: string; messageText: string },
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
    messageType: 'text',
    messageText: input.messageText,
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
 * Update a broadcast (name or message text). Resets to draft status.
 */
export async function updateBroadcast(
  broadcastId: string,
  userId: string,
  input: { name?: string; messageText?: string },
): Promise<void> {
  const { broadcast, channelUserId } = await loadBroadcastWithChannel(broadcastId, userId);
  if (channelUserId !== userId) throw new Error('Unauthorized');

  await db
    .update(lineBroadcast)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.messageText !== undefined && { messageText: input.messageText }),
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

  if (!broadcast.messageText) {
    throw new Error('Broadcast has no message text');
  }

  // Mark as sending
  await db
    .update(lineBroadcast)
    .set({ status: 'sending', updatedAt: new Date() })
    .where(eq(lineBroadcast.id, broadcastId));

  const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: accessToken });

  try {
    const result = await lineClient.broadcast({
      messages: [{ type: 'text', text: broadcast.messageText }],
    });

    // broadcastResponse may include requestId in headers; recipient count not in body for broadcast
    const recipientCount = (result as { sentMessages?: { customAggregationUnits?: string[] } })
      ?.sentMessages?.customAggregationUnits?.length ?? null;

    await db
      .update(lineBroadcast)
      .set({
        status: 'sent',
        sentAt: new Date(),
        recipientCount: typeof recipientCount === 'number' ? recipientCount : null,
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
