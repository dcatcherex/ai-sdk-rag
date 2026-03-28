import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent, publicAgentShare } from '@/db/schema';
import { hashPassword } from '@/lib/guest-session';

type Params = { params: Promise<{ id: string }> };

// GET — return current share state for this agent (owner only)
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [agentRow] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, session.user.id)))
    .limit(1);
  if (!agentRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [share] = await db
    .select()
    .from(publicAgentShare)
    .where(eq(publicAgentShare.agentId, id))
    .limit(1);

  if (!share) return NextResponse.json({ share: null });

  // Never expose passwordHash to the client — return a boolean flag instead
  return NextResponse.json({
    share: {
      ...share,
      passwordHash: undefined,
      hasPassword: Boolean(share.passwordHash),
    },
  });
}

// POST — create or update share link settings
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [agentRow] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, session.user.id)))
    .limit(1);
  if (!agentRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    isActive?: boolean;
    guestMessageLimit?: number | null;
    password?: string | null;       // plain text; null = remove password
    expiresAt?: string | null;      // ISO date string; null = never
  };

  const existing = await db
    .select()
    .from(publicAgentShare)
    .where(eq(publicAgentShare.agentId, id))
    .limit(1);

  // Compute new passwordHash only when explicitly set
  let newPasswordHash: string | null | undefined = undefined; // undefined = keep existing
  if (body.password !== undefined) {
    newPasswordHash = body.password ? hashPassword(body.password) : null;
  }

  const newExpiresAt: Date | null | undefined =
    body.expiresAt !== undefined
      ? body.expiresAt
        ? new Date(body.expiresAt)
        : null
      : undefined;

  if (existing[0]) {
    const updated = await db
      .update(publicAgentShare)
      .set({
        isActive: body.isActive ?? existing[0].isActive,
        guestMessageLimit: body.guestMessageLimit !== undefined ? body.guestMessageLimit : existing[0].guestMessageLimit,
        ...(newPasswordHash !== undefined ? { passwordHash: newPasswordHash } : {}),
        ...(newExpiresAt !== undefined ? { expiresAt: newExpiresAt } : {}),
      })
      .where(eq(publicAgentShare.agentId, id))
      .returning();

    const row = updated[0]!;
    return NextResponse.json({
      share: { ...row, passwordHash: undefined, hasPassword: Boolean(row.passwordHash) },
    });
  }

  // Create new share
  const shareToken = nanoid(9);
  const [created] = await db
    .insert(publicAgentShare)
    .values({
      id: nanoid(),
      agentId: id,
      shareToken,
      isActive: true,
      guestMessageLimit: body.guestMessageLimit ?? null,
      passwordHash: newPasswordHash ?? null,
      expiresAt: newExpiresAt ?? null,
    })
    .returning();

  return NextResponse.json({
    share: { ...created, passwordHash: undefined, hasPassword: Boolean(created!.passwordHash) },
  });
}

// DELETE — revoke share (delete row)
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [agentRow] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, session.user.id)))
    .limit(1);
  if (!agentRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(publicAgentShare).where(eq(publicAgentShare.agentId, id));
  return NextResponse.json({ ok: true });
}
