import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { publicAgentShare } from '@/db/schema';
import { verifyPassword, makeSessionToken } from '@/lib/guest-session';

type Params = { params: Promise<{ token: string }> };

export async function POST(req: Request, { params }: Params) {
  const { token } = await params;

  const [share] = await db
    .select({ passwordHash: publicAgentShare.passwordHash, expiresAt: publicAgentShare.expiresAt, isActive: publicAgentShare.isActive })
    .from(publicAgentShare)
    .where(and(eq(publicAgentShare.shareToken, token), eq(publicAgentShare.isActive, true)))
    .limit(1);

  if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This link has expired.' }, { status: 410 });
  }

  if (!share.passwordHash) {
    // No password set — return session token anyway (open link)
    return NextResponse.json({ sessionToken: makeSessionToken(token) });
  }

  const body = await req.json().catch(() => ({})) as { password?: string };
  if (!body.password) {
    return NextResponse.json({ error: 'Password required.' }, { status: 400 });
  }

  if (!verifyPassword(body.password, share.passwordHash)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  return NextResponse.json({ sessionToken: makeSessionToken(token) });
}
