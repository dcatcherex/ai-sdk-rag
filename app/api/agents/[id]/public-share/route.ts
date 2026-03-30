import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent, publicAgentShare } from '@/db/schema';
import { hashPassword } from '@/lib/guest-session';

type Params = { params: Promise<{ id: string }> };

function toClient(row: typeof publicAgentShare.$inferSelect) {
  return {
    ...row,
    passwordHash: undefined,
    hasPassword: Boolean(row.passwordHash),
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

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

  return NextResponse.json({ share: share ? toClient(share) : null });
}

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
    password?: string | null;
    expiresAt?: string | null;
    maxUses?: number | null;
    creditLimit?: number | null;
    welcomeMessage?: string | null;
  };

  const [existing] = await db
    .select()
    .from(publicAgentShare)
    .where(eq(publicAgentShare.agentId, id))
    .limit(1);

  let newPasswordHash: string | null | undefined = undefined;
  if (body.password !== undefined) {
    newPasswordHash = body.password ? hashPassword(body.password) : null;
  }
  const newExpiresAt: Date | null | undefined =
    body.expiresAt !== undefined
      ? body.expiresAt ? new Date(body.expiresAt) : null
      : undefined;

  if (existing) {
    const [updated] = await db
      .update(publicAgentShare)
      .set({
        isActive: body.isActive ?? existing.isActive,
        guestMessageLimit: body.guestMessageLimit !== undefined ? body.guestMessageLimit : existing.guestMessageLimit,
        maxUses: body.maxUses !== undefined ? body.maxUses : existing.maxUses,
        creditLimit: body.creditLimit !== undefined ? body.creditLimit : existing.creditLimit,
        welcomeMessage: body.welcomeMessage !== undefined ? body.welcomeMessage : existing.welcomeMessage,
        ...(newPasswordHash !== undefined ? { passwordHash: newPasswordHash } : {}),
        ...(newExpiresAt !== undefined ? { expiresAt: newExpiresAt } : {}),
      })
      .where(eq(publicAgentShare.agentId, id))
      .returning();
    return NextResponse.json({ share: toClient(updated!) });
  }

  const [created] = await db
    .insert(publicAgentShare)
    .values({
      id: nanoid(),
      agentId: id,
      shareToken: nanoid(9),
      isActive: true,
      guestMessageLimit: body.guestMessageLimit ?? null,
      passwordHash: newPasswordHash ?? null,
      expiresAt: newExpiresAt ?? null,
      maxUses: body.maxUses ?? null,
      creditLimit: body.creditLimit ?? null,
      welcomeMessage: body.welcomeMessage ?? null,
    })
    .returning();
  return NextResponse.json({ share: toClient(created!) });
}

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
