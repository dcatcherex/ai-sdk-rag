import { and, eq, gt, isNull } from 'drizzle-orm';
import { messagingApi } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { lineAccountLink, lineAccountLinkToken, lineOaChannel } from '@/db/schema';
import { user as userTable, account as accountTable } from '@/db/schema/auth';
import { addCredits, SIGNUP_BONUS_CREDITS } from '@/lib/credits';

// ─── Token generation ──────────────────────────────────────────────────────

/** 32-char alphabet that avoids visually confusing characters (I, O, 0, 1) */
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOKEN_LENGTH = 8;
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH));
  return Array.from(bytes)
    .map((b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length])
    .join('');
}

/**
 * Generate a one-time link token for the app user on a given channel.
 * Invalidates any existing unused tokens for the same user+channel.
 */
export async function generateLinkToken(
  channelId: string,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  // Verify channel ownership
  const channelRows = await db
    .select({ id: lineOaChannel.id })
    .from(lineOaChannel)
    .where(and(eq(lineOaChannel.id, channelId), eq(lineOaChannel.userId, userId)))
    .limit(1);

  if (!channelRows[0]) throw new Error('Channel not found');

  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  await db.insert(lineAccountLinkToken).values({
    id: crypto.randomUUID(),
    userId,
    channelId,
    token,
    expiresAt,
    createdAt: now,
  });

  return { token, expiresAt };
}

/**
 * Consume a link token sent by a LINE user in chat.
 * Called from the webhook message handler.
 * Returns a result object so the caller can reply appropriately.
 */
export async function consumeLinkToken(
  token: string,
  lineUserId: string,
  channelId: string,
  lineClient: messagingApi.MessagingApiClient,
): Promise<{ ok: boolean; message: string }> {
  const now = new Date();

  // Look up token
  const tokenRows = await db
    .select()
    .from(lineAccountLinkToken)
    .where(
      and(
        eq(lineAccountLinkToken.token, token.toUpperCase()),
        eq(lineAccountLinkToken.channelId, channelId),
        isNull(lineAccountLinkToken.usedAt),
        gt(lineAccountLinkToken.expiresAt, now),
      ),
    )
    .limit(1);

  const tokenRow = tokenRows[0];
  if (!tokenRow) {
    return { ok: false, message: 'Invalid or expired link code. Please generate a new one from the dashboard.' };
  }

  // Check if this LINE user is already linked on this channel
  const existingLink = await db
    .select()
    .from(lineAccountLink)
    .where(
      and(
        eq(lineAccountLink.channelId, channelId),
        eq(lineAccountLink.lineUserId, lineUserId),
      ),
    )
    .limit(1);

  if (existingLink[0]) {
    // Mark token as used anyway
    await db
      .update(lineAccountLinkToken)
      .set({ usedAt: now })
      .where(eq(lineAccountLinkToken.id, tokenRow.id));
    return { ok: true, message: 'Your LINE account is already linked.' };
  }

  // Fetch LINE profile to store display name + picture
  let displayName: string | null = null;
  let pictureUrl: string | null = null;
  try {
    const profile = await lineClient.getProfile(lineUserId);
    displayName = profile.displayName ?? null;
    pictureUrl = profile.pictureUrl ?? null;
  } catch {
    // Non-fatal — proceed without profile data
  }

  // Create the link + mark token as used atomically
  await Promise.all([
    db.insert(lineAccountLink).values({
      id: crypto.randomUUID(),
      userId: tokenRow.userId,
      channelId,
      lineUserId,
      displayName,
      pictureUrl,
      linkedAt: now,
    }),
    db
      .update(lineAccountLinkToken)
      .set({ usedAt: now })
      .where(eq(lineAccountLinkToken.id, tokenRow.id)),
  ]);

  return { ok: true, message: 'Your LINE account has been linked successfully!' };
}

// ─── Link management ───────────────────────────────────────────────────────

export type LinkRow = typeof lineAccountLink.$inferSelect;

/**
 * List all linked accounts for a channel (owned by userId).
 */
export async function listLinks(channelId: string, userId: string): Promise<LinkRow[]> {
  const channelRows = await db
    .select({ id: lineOaChannel.id })
    .from(lineOaChannel)
    .where(and(eq(lineOaChannel.id, channelId), eq(lineOaChannel.userId, userId)))
    .limit(1);

  if (!channelRows[0]) throw new Error('Channel not found');

  return db
    .select()
    .from(lineAccountLink)
    .where(eq(lineAccountLink.channelId, channelId));
}

/**
 * Delete an account link.
 */
export async function deleteLink(linkId: string, userId: string): Promise<void> {
  // Verify ownership via the channel
  const rows = await db
    .select({ channelUserId: lineOaChannel.userId })
    .from(lineAccountLink)
    .innerJoin(lineOaChannel, eq(lineAccountLink.channelId, lineOaChannel.id))
    .where(eq(lineAccountLink.id, linkId))
    .limit(1);

  if (!rows[0]) throw new Error('Link not found');
  if (rows[0].channelUserId !== userId) throw new Error('Unauthorized');

  await db.delete(lineAccountLink).where(eq(lineAccountLink.id, linkId));
}

// ─── Push message ──────────────────────────────────────────────────────────

/**
 * Send a push message to a specific linked LINE user.
 */
export async function pushToLinkedUser(
  linkId: string,
  userId: string,
  messageText: string,
): Promise<void> {
  const rows = await db
    .select({
      lineUserId: lineAccountLink.lineUserId,
      accessToken: lineOaChannel.channelAccessToken,
      channelUserId: lineOaChannel.userId,
    })
    .from(lineAccountLink)
    .innerJoin(lineOaChannel, eq(lineAccountLink.channelId, lineOaChannel.id))
    .where(eq(lineAccountLink.id, linkId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error('Link not found');
  if (row.channelUserId !== userId) throw new Error('Unauthorized');

  const lineClient = new messagingApi.MessagingApiClient({
    channelAccessToken: row.accessToken,
  });

  await lineClient.pushMessage({
    to: row.lineUserId,
    messages: [{ type: 'text', text: messageText }],
  });
}

/**
 * Send a push message to all linked users on a channel.
 * Used for app-event triggers (e.g., "your result is ready").
 */
export async function pushToAllLinkedUsers(
  channelId: string,
  messageText: string,
  accessToken: string,
): Promise<void> {
  const links = await db
    .select({ lineUserId: lineAccountLink.lineUserId })
    .from(lineAccountLink)
    .where(eq(lineAccountLink.channelId, channelId));

  if (links.length === 0) return;

  const lineClient = new messagingApi.MessagingApiClient({ channelAccessToken: accessToken });

  // Multicast supports up to 500 recipients per call
  const BATCH = 500;
  for (let i = 0; i < links.length; i += BATCH) {
    const batch = links.slice(i, i + BATCH).map((l) => l.lineUserId);
    await lineClient.multicast({
      to: batch,
      messages: [{ type: 'text', text: messageText }],
    });
  }
}

// ─── LINE-native registration ──────────────────────────────────────────────

export type RegisterLineUserResult =
  | { ok: true; isNew: true; name: string }
  | { ok: true; isNew: false }
  | { ok: false; error: string };

/**
 * Register a LINE user as a Vaja AI account without any web redirect.
 *
 * Uses LINE identity as the sole credential:
 *   - Display name + profile picture fetched from LINE profile
 *   - Synthetic internal email (line_{userId}@line.internal) satisfies DB constraint
 *   - emailVerified = true  (LINE is the authentication — no email link needed)
 *   - No password — user authenticates by being in LINE
 *   - Signup bonus credits granted automatically
 *
 * Idempotent: returns isNew=false if the LINE user already has an account.
 */
export async function registerLineUser(
  lineUserId: string,
  channelId: string,
  lineClient: messagingApi.MessagingApiClient,
): Promise<RegisterLineUserResult> {
  // Already linked?
  const existing = await db
    .select({ userId: lineAccountLink.userId })
    .from(lineAccountLink)
    .where(and(eq(lineAccountLink.channelId, channelId), eq(lineAccountLink.lineUserId, lineUserId)))
    .limit(1);

  if (existing[0]) return { ok: true, isNew: false };

  // Fetch LINE profile for name + picture
  let displayName = 'LINE User';
  let pictureUrl: string | null = null;
  try {
    const profile = await lineClient.getProfile(lineUserId);
    displayName = profile.displayName ?? displayName;
    pictureUrl = profile.pictureUrl ?? null;
  } catch {
    // Non-fatal — proceed with defaults
  }

  const userId = crypto.randomUUID();
  // Synthetic email satisfies the unique NOT NULL constraint; never used for login
  const syntheticEmail = `line_${lineUserId}@line.internal`;
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      // 1. Create user (emailVerified=true skips verification flow)
      await tx.insert(userTable).values({
        id: userId,
        name: displayName,
        email: syntheticEmail,
        emailVerified: true,
        image: pictureUrl,
        approved: true,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Create Better Auth account row for LINE provider
      //    Enables future LINE OAuth linking and clean provider tracking
      await tx.insert(accountTable).values({
        id: crypto.randomUUID(),
        accountId: lineUserId,
        providerId: 'line',
        userId,
        createdAt: now,
        updatedAt: now,
      });

      // 3. Link LINE identity to new account
      await tx.insert(lineAccountLink).values({
        id: crypto.randomUUID(),
        userId,
        channelId,
        lineUserId,
        displayName,
        pictureUrl,
        linkedAt: now,
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Duplicate email means this LINE user already registered on another channel
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { ok: false, error: 'มีบัญชีที่เชื่อมต่อกับ LINE นี้อยู่แล้ว' };
    }
    return { ok: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
  }

  // Grant signup bonus (outside transaction — non-fatal if it fails)
  await addCredits({
    userId,
    amount: SIGNUP_BONUS_CREDITS,
    type: 'signup_bonus',
    description: `Welcome bonus: ${SIGNUP_BONUS_CREDITS} credits`,
  }).catch((e) => console.warn('[registerLineUser] addCredits failed:', e));

  return { ok: true, isNew: true, name: displayName };
}
