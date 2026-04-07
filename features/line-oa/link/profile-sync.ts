import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { lineAccountLink } from '@/db/schema';

const PROFILE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * In-process TTL cache: `channelId:lineUserId` → last sync timestamp (ms).
 * Resets on cold start — acceptable for serverless; prevents per-message API calls within a warm instance.
 */
const profileSyncCache = new Map<string, number>();

type LineProfile = {
  displayName?: string;
  pictureUrl?: string;
};

/**
 * Refresh a linked user's LINE display name and picture if the cached copy is older than 24 hours.
 * Fire-and-forget — never throws, logs errors silently.
 */
export async function maybeSyncUserProfile(
  lineUserId: string,
  channelId: string,
  channelAccessToken: string,
): Promise<void> {
  try {
    const cacheKey = `${channelId}:${lineUserId}`;
    const lastSync = profileSyncCache.get(cacheKey) ?? 0;
    const nowMs = Date.now();
    if (nowMs - lastSync < PROFILE_TTL_MS) return; // still fresh
    profileSyncCache.set(cacheKey, nowMs);

    const rows = await db
      .select({ id: lineAccountLink.id })
      .from(lineAccountLink)
      .where(and(eq(lineAccountLink.channelId, channelId), eq(lineAccountLink.lineUserId, lineUserId)))
      .limit(1);

    const row = rows[0];
    if (!row) return;

    const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
      headers: { Authorization: `Bearer ${channelAccessToken}` },
    });
    if (!res.ok) return;

    const profile = (await res.json()) as LineProfile;
    if (!profile.displayName) return;

    await db
      .update(lineAccountLink)
      .set({
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl ?? null,
      })
      .where(eq(lineAccountLink.id, row.id));
  } catch (err) {
    console.error('[LINE] maybeSyncUserProfile failed:', err);
  }
}
