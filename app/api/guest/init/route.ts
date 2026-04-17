import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getPlatformSettings } from '@/lib/platform-settings';
import { parseGuestCookie, getGuestSessionById, initGuestSession, buildGuestCookieHeader } from '@/lib/guest-access';
import { getConfiguredGuestStarterAgent } from '@/features/agents/server/starter';

export async function POST(req: Request) {
  // Authenticated users don't need guest sessions
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (session?.user) {
    return Response.json({ error: 'Already authenticated' }, { status: 400 });
  }

  const settings = await getPlatformSettings();
  if (!settings.guestAccessEnabled) {
    return Response.json({ error: 'Guest access is not enabled' }, { status: 403 });
  }
  const guestStarterAgent = await getConfiguredGuestStarterAgent();
  if (!guestStarterAgent) {
    return Response.json({ error: 'Guest starter agent is not configured' }, { status: 403 });
  }

  // Check for existing valid cookie first
  const cookieHeader = h.get('cookie');
  const existingGuestId = parseGuestCookie(cookieHeader);
  if (existingGuestId) {
    const existing = await getGuestSessionById(existingGuestId);
    if (existing) {
      return Response.json({
        id: existing.id,
        credits: existing.credits,
        expiresAt: existing.expiresAt.toISOString(),
        isNew: false,
      });
    }
  }

  // Resolve client IP (respect proxy headers)
  const forwarded = h.get('x-forwarded-for');
  const realIp = h.get('x-real-ip');
  const rawIp = (forwarded ? forwarded.split(',')[0] : realIp ?? 'unknown').trim();

  const { session: gs, isNew, ttlDays } = await initGuestSession(rawIp);

  const cookieStr = buildGuestCookieHeader(gs.id, ttlDays);

  return new Response(
    JSON.stringify({
      id: gs.id,
      credits: gs.credits,
      expiresAt: gs.expiresAt.toISOString(),
      isNew,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieStr,
      },
    },
  );
}
