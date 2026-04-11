import { and, eq } from 'drizzle-orm';
import { chatRun, user } from '@/db/schema';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { runId } = await context.params;

  const rows = await db
    .select({
      id: chatRun.id,
      userId: chatRun.userId,
      userName: user.name,
      userEmail: user.email,
      threadId: chatRun.threadId,
      agentId: chatRun.agentId,
      brandId: chatRun.brandId,
      status: chatRun.status,
      routeKind: chatRun.routeKind,
      requestedModelId: chatRun.requestedModelId,
      resolvedModelId: chatRun.resolvedModelId,
      routingMode: chatRun.routingMode,
      routingReason: chatRun.routingReason,
      useWebSearch: chatRun.useWebSearch,
      usedTools: chatRun.usedTools,
      toolCallCount: chatRun.toolCallCount,
      creditCost: chatRun.creditCost,
      promptTokens: chatRun.promptTokens,
      completionTokens: chatRun.completionTokens,
      totalTokens: chatRun.totalTokens,
      inputJson: chatRun.inputJson,
      outputJson: chatRun.outputJson,
      errorMessage: chatRun.errorMessage,
      startedAt: chatRun.startedAt,
      createdAt: chatRun.createdAt,
      completedAt: chatRun.completedAt,
    })
    .from(chatRun)
    .leftJoin(user, eq(chatRun.userId, user.id))
    .where(and(eq(chatRun.id, runId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return Response.json({ error: 'Chat run not found' }, { status: 404 });
  }

  return Response.json({
    ...row,
    status: row.status === 'success' || row.status === 'error' ? row.status : 'pending',
    routeKind: row.routeKind === 'image' ? 'image' : 'text',
    routingMode: row.routingMode === 'manual' || row.routingMode === 'auto' ? row.routingMode : null,
    inputJson: row.inputJson,
    outputJson: row.outputJson,
    startedAt: row.startedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  });
}
