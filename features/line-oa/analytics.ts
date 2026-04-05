/**
 * LINE channel analytics — daily stat tracking and query helpers.
 *
 * Called fire-and-forget after every processed message event.
 */

import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { lineChannelDailyStat, lineChannelDailyUser } from '@/db/schema';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export type DailyStatRow = {
  date: string;
  messageCount: number;
  uniqueUsers: number;
  toolCallCount: number;
  imagesSent: number;
};

/**
 * Record one processed message for a channel.
 * - Upserts the daily aggregate stat row (increments messageCount, toolCallCount, imagesSent).
 * - Upserts the daily-user row, then sets uniqueUsers = COUNT(distinct users that day).
 */
export async function recordMessageEvent(
  channelId: string,
  lineUserId: string,
  opts: { toolCallCount?: number; imagesSent?: number } = {},
): Promise<void> {
  const date = todayStr();
  const toolCalls = opts.toolCallCount ?? 0;
  const images = opts.imagesSent ?? 0;

  // 1. Ensure a daily-user row exists (idempotent)
  await db
    .insert(lineChannelDailyUser)
    .values({ id: crypto.randomUUID(), channelId, date, lineUserId })
    .onConflictDoNothing();

  // 2. Count distinct users today (after the upsert above)
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lineChannelDailyUser)
    .where(and(eq(lineChannelDailyUser.channelId, channelId), eq(lineChannelDailyUser.date, date)));
  const uniqueUsers = countRow?.count ?? 1;

  // 3. Upsert the daily stat row
  await db
    .insert(lineChannelDailyStat)
    .values({
      id: crypto.randomUUID(),
      channelId,
      date,
      messageCount: 1,
      uniqueUsers,
      toolCallCount: toolCalls,
      imagesSent: images,
    })
    .onConflictDoUpdate({
      target: [lineChannelDailyStat.channelId, lineChannelDailyStat.date],
      set: {
        messageCount: sql`${lineChannelDailyStat.messageCount} + 1`,
        uniqueUsers,
        toolCallCount: sql`${lineChannelDailyStat.toolCallCount} + ${toolCalls}`,
        imagesSent: sql`${lineChannelDailyStat.imagesSent} + ${images}`,
      },
    });
}

/**
 * Return the last `days` days of daily stats for a channel (most recent first).
 */
export async function getChannelStats(channelId: string, days = 7): Promise<DailyStatRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      date: lineChannelDailyStat.date,
      messageCount: lineChannelDailyStat.messageCount,
      uniqueUsers: lineChannelDailyStat.uniqueUsers,
      toolCallCount: lineChannelDailyStat.toolCallCount,
      imagesSent: lineChannelDailyStat.imagesSent,
    })
    .from(lineChannelDailyStat)
    .where(
      and(
        eq(lineChannelDailyStat.channelId, channelId),
        gte(lineChannelDailyStat.date, cutoffStr),
      ),
    )
    .orderBy(desc(lineChannelDailyStat.date));

  return rows;
}
