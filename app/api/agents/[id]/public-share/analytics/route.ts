import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq, and, sql, gte } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent, publicAgentShare, publicAgentShareEvent } from '@/db/schema';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership
  const [agentRow] = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, session.user.id)))
    .limit(1);
  if (!agentRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get the share token
  const [share] = await db
    .select({ shareToken: publicAgentShare.shareToken })
    .from(publicAgentShare)
    .where(eq(publicAgentShare.agentId, id))
    .limit(1);
  if (!share) return NextResponse.json({ dailyStats: [], topMessages: [], totals: { views: 0, chats: 0, uniqueSessions: 0 } });

  const { shareToken } = share;
  const since = new Date();
  since.setDate(since.getDate() - 13); // last 14 days including today
  since.setHours(0, 0, 0, 0);

  // Daily stats: group by date, count views vs chats and unique sessions
  const dailyRows = await db
    .select({
      day: sql<string>`DATE(${publicAgentShareEvent.createdAt})`.as('day'),
      views: sql<number>`COUNT(*) FILTER (WHERE ${publicAgentShareEvent.eventType} = 'view')`.as('views'),
      chats: sql<number>`COUNT(*) FILTER (WHERE ${publicAgentShareEvent.eventType} = 'chat')`.as('chats'),
      uniqueSessions: sql<number>`COUNT(DISTINCT ${publicAgentShareEvent.sessionId})`.as('unique_sessions'),
    })
    .from(publicAgentShareEvent)
    .where(
      and(
        eq(publicAgentShareEvent.shareToken, shareToken),
        gte(publicAgentShareEvent.createdAt, since),
      ),
    )
    .groupBy(sql`DATE(${publicAgentShareEvent.createdAt})`)
    .orderBy(sql`DATE(${publicAgentShareEvent.createdAt})`);

  // Fill in missing days so the chart always has 14 points
  const dailyMap = new Map(dailyRows.map((r) => [r.day, r]));
  const dailyStats: Array<{ day: string; views: number; chats: number; uniqueSessions: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0]!;
    const row = dailyMap.get(key);
    dailyStats.push({
      day: key,
      views: Number(row?.views ?? 0),
      chats: Number(row?.chats ?? 0),
      uniqueSessions: Number(row?.uniqueSessions ?? 0),
    });
  }

  // Top first messages (chat events with firstMessage, all time)
  const topRows = await db
    .select({
      message: publicAgentShareEvent.firstMessage,
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(publicAgentShareEvent)
    .where(
      and(
        eq(publicAgentShareEvent.shareToken, shareToken),
        eq(publicAgentShareEvent.eventType, 'chat'),
        sql`${publicAgentShareEvent.firstMessage} IS NOT NULL`,
      ),
    )
    .groupBy(publicAgentShareEvent.firstMessage)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(5);

  const topMessages = topRows.map((r) => ({
    message: r.message!,
    count: Number(r.count),
  }));

  // All-time totals
  const [totalsRow] = await db
    .select({
      views: sql<number>`COUNT(*) FILTER (WHERE ${publicAgentShareEvent.eventType} = 'view')`,
      chats: sql<number>`COUNT(*) FILTER (WHERE ${publicAgentShareEvent.eventType} = 'chat')`,
      uniqueSessions: sql<number>`COUNT(DISTINCT ${publicAgentShareEvent.sessionId})`,
    })
    .from(publicAgentShareEvent)
    .where(eq(publicAgentShareEvent.shareToken, shareToken));

  return NextResponse.json({
    dailyStats,
    topMessages,
    totals: {
      views: Number(totalsRow?.views ?? 0),
      chats: Number(totalsRow?.chats ?? 0),
      uniqueSessions: Number(totalsRow?.uniqueSessions ?? 0),
    },
  });
}
