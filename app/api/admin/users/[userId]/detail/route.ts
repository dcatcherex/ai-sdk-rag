import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user, userCredit } from '@/db/schema';
import { chatRun } from '@/db/schema/chat';
import { toolRun, workspaceAiRun } from '@/db/schema/tools';
import { creditTransaction } from '@/db/schema/credits';
import { requireAdmin } from '@/lib/admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { userId } = await params;

  const [
    userRow,
    creditRow,
    chatRuns,
    toolRuns,
    workspaceRuns,
    transactions,
    statsRow,
  ] = await Promise.all([
    db.select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
      .from(user).where(eq(user.id, userId)).limit(1),

    db.select({ balance: userCredit.balance })
      .from(userCredit).where(eq(userCredit.userId, userId)).limit(1),

    db.select({
      id: chatRun.id,
      status: chatRun.status,
      routeKind: chatRun.routeKind,
      resolvedModelId: chatRun.resolvedModelId,
      creditCost: chatRun.creditCost,
      totalTokens: chatRun.totalTokens,
      createdAt: chatRun.createdAt,
    }).from(chatRun).where(eq(chatRun.userId, userId))
      .orderBy(desc(chatRun.createdAt)).limit(10),

    db.select({
      id: toolRun.id,
      status: toolRun.status,
      toolSlug: toolRun.toolSlug,
      createdAt: toolRun.createdAt,
    }).from(toolRun).where(eq(toolRun.userId, userId))
      .orderBy(desc(toolRun.createdAt)).limit(10),

    db.select({
      id: workspaceAiRun.id,
      status: workspaceAiRun.status,
      kind: workspaceAiRun.kind,
      route: workspaceAiRun.route,
      createdAt: workspaceAiRun.createdAt,
    }).from(workspaceAiRun).where(eq(workspaceAiRun.userId, userId))
      .orderBy(desc(workspaceAiRun.createdAt)).limit(10),

    db.select({
      id: creditTransaction.id,
      amount: creditTransaction.amount,
      balance: creditTransaction.balance,
      type: creditTransaction.type,
      description: creditTransaction.description,
      createdAt: creditTransaction.createdAt,
    }).from(creditTransaction).where(eq(creditTransaction.userId, userId))
      .orderBy(desc(creditTransaction.createdAt)).limit(15),

    db.select({
      totalRuns: sql<number>`COALESCE((
        SELECT COUNT(*) FROM (
          SELECT id FROM chat_run WHERE user_id = ${userId}
          UNION ALL
          SELECT id FROM tool_run WHERE user_id = ${userId}
          UNION ALL
          SELECT id FROM workspace_ai_run WHERE user_id = ${userId}
        ) r
      ), 0)`,
      creditsUsed: sql<number>`COALESCE((
        SELECT SUM(ABS(amount)) FROM credit_transaction
        WHERE user_id = ${userId} AND amount < 0
      ), 0)`,
      lastActiveAt: sql<string | null>`(
        SELECT MAX(r.created_at) FROM (
          SELECT created_at FROM chat_run WHERE user_id = ${userId}
          UNION ALL
          SELECT created_at FROM tool_run WHERE user_id = ${userId}
          UNION ALL
          SELECT created_at FROM workspace_ai_run WHERE user_id = ${userId}
        ) r
      )`,
    }).from(sql`(SELECT 1) AS _dummy`),
  ]);

  if (!userRow[0]) return Response.json({ error: 'User not found' }, { status: 404 });

  // Merge chat/tool/workspace runs into one sorted list
  type RunEntry = {
    id: string;
    type: 'chat' | 'tool' | 'workspace';
    status: string;
    label: string;
    detail: string | null;
    createdAt: string | Date;
  };

  const allRuns: RunEntry[] = [
    ...chatRuns.map((r) => ({
      id: r.id,
      type: 'chat' as const,
      status: r.status,
      label: r.routeKind ?? 'chat',
      detail: r.resolvedModelId,
      createdAt: r.createdAt,
    })),
    ...toolRuns.map((r) => ({
      id: r.id,
      type: 'tool' as const,
      status: r.status,
      label: r.toolSlug,
      detail: null,
      createdAt: r.createdAt,
    })),
    ...workspaceRuns.map((r) => ({
      id: r.id,
      type: 'workspace' as const,
      status: r.status,
      label: r.kind,
      detail: r.route,
      createdAt: r.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 15);

  const stats = statsRow[0] ?? { totalRuns: 0, creditsUsed: 0, lastActiveAt: null };

  return Response.json({
    user: {
      ...userRow[0],
      balance: creditRow[0]?.balance ?? 0,
    },
    stats: {
      totalRuns: Number(stats.totalRuns),
      creditsUsed: Number(stats.creditsUsed),
      lastActiveAt: stats.lastActiveAt,
    },
    recentRuns: allRuns,
    recentTransactions: transactions,
  });
}
