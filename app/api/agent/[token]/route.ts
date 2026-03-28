import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { agent, publicAgentShare } from '@/db/schema';

type Params = { params: Promise<{ token: string }> };

// Public — no auth required
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;

  const [share] = await db
    .select()
    .from(publicAgentShare)
    .where(and(eq(publicAgentShare.shareToken, token), eq(publicAgentShare.isActive, true)))
    .limit(1);

  if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Expiry check
  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  const [agentRow] = await db
    .select({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      modelId: agent.modelId,
      enabledTools: agent.enabledTools,
      documentIds: agent.documentIds,
    })
    .from(agent)
    .where(eq(agent.id, share.agentId))
    .limit(1);

  if (!agentRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    agent: agentRow,
    share: {
      shareToken: share.shareToken,
      conversationCount: share.conversationCount,
      guestMessageLimit: share.guestMessageLimit,
      requiresPassword: Boolean(share.passwordHash),
      expiresAt: share.expiresAt?.toISOString() ?? null,
    },
  });
}
