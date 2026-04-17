import { createHash } from 'crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { guestSession } from '@/db/schema';
import { getPlatformSettings } from '@/lib/platform-settings';

export type GuestSessionRow = {
  id: string;
  credits: number;
  expiresAt: Date;
};

/** Hash an IP address so raw IPs are never stored. */
function hashIp(ip: string): string {
  const salt = process.env.BETTER_AUTH_SECRET ?? 'vaja-guest-salt';
  return createHash('sha256').update(ip + salt).digest('hex');
}

/** Parse the `vaja-guest` cookie value from a raw Cookie header string. */
export function parseGuestCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)vaja-guest=([^;]+)/);
  return match?.[1] ?? null;
}

/** Build a Set-Cookie header string for the guest session cookie. */
export function buildGuestCookieHeader(guestId: string, ttlDays: number): string {
  const maxAge = ttlDays * 24 * 60 * 60;
  return `vaja-guest=${guestId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * Load a valid (non-expired) guest session by ID.
 * Returns null if the session doesn't exist or has expired.
 */
export async function getGuestSessionById(guestId: string): Promise<GuestSessionRow | null> {
  const rows = await db
    .select({ id: guestSession.id, credits: guestSession.credits, expiresAt: guestSession.expiresAt })
    .from(guestSession)
    .where(and(eq(guestSession.id, guestId), gt(guestSession.expiresAt, new Date())))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Initialize a guest session for a request.
 * Anti-abuse: if the IP already has an active session created today, return that.
 * Otherwise create a new session with `guestStartingCredits` from platform settings.
 */
export async function initGuestSession(rawIp: string): Promise<{
  session: GuestSessionRow;
  isNew: boolean;
  ttlDays: number;
}> {
  const settings = await getPlatformSettings();
  const ipHash = hashIp(rawIp);
  const now = new Date();

  // Anti-abuse: look for an active session from this IP created in the last 24h
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const existing = await db
    .select({ id: guestSession.id, credits: guestSession.credits, expiresAt: guestSession.expiresAt })
    .from(guestSession)
    .where(
      and(
        eq(guestSession.ipHash, ipHash),
        gt(guestSession.expiresAt, now),
        gt(guestSession.createdAt, oneDayAgo),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return { session: existing[0], isNew: false, ttlDays: settings.guestSessionTtlDays };
  }

  // Create a new session
  const id = nanoid();
  const expiresAt = new Date(now.getTime() + settings.guestSessionTtlDays * 24 * 60 * 60 * 1000);
  const credits = settings.guestStartingCredits;

  await db.insert(guestSession).values({ id, ipHash, credits, totalGranted: credits, expiresAt });

  return {
    session: { id, credits, expiresAt },
    isNew: true,
    ttlDays: settings.guestSessionTtlDays,
  };
}

/**
 * Deduct credits from a guest session.
 * Returns { success, balance }.
 */
export async function deductGuestCredits(
  guestId: string,
  amount: number,
): Promise<{ success: boolean; balance: number }> {
  const current = await db
    .select({ credits: guestSession.credits })
    .from(guestSession)
    .where(eq(guestSession.id, guestId))
    .limit(1);

  const currentBalance = current[0]?.credits ?? 0;
  if (currentBalance < amount) {
    return { success: false, balance: currentBalance };
  }

  const updated = await db
    .update(guestSession)
    .set({ credits: sql`${guestSession.credits} - ${amount}` })
    .where(eq(guestSession.id, guestId))
    .returning({ credits: guestSession.credits });

  return { success: true, balance: updated[0]?.credits ?? 0 };
}
