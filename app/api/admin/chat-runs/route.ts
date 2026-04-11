import { and, desc, eq, gte, ilike, lt, sql } from 'drizzle-orm';
import { chatRun, user } from '@/db/schema';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

const allowedStatuses = new Set(['pending', 'success', 'error']);
const allowedRouteKinds = new Set(['text', 'image']);

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const url = new URL(req.url);
  const search = url.searchParams.get('search')?.trim() ?? '';
  const status = url.searchParams.get('status')?.trim() ?? '';
  const routeKind = url.searchParams.get('routeKind')?.trim() ?? '';
  const resolvedModelId = url.searchParams.get('resolvedModelId')?.trim() ?? '';
  const dateFrom = url.searchParams.get('dateFrom')?.trim() ?? '';
  const dateTo = url.searchParams.get('dateTo')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(${chatRun.threadId} ILIKE ${pattern} OR ${user.email} ILIKE ${pattern} OR ${user.name} ILIKE ${pattern})`,
    );
  }

  if (allowedStatuses.has(status)) {
    conditions.push(eq(chatRun.status, status));
  }

  if (allowedRouteKinds.has(routeKind)) {
    conditions.push(eq(chatRun.routeKind, routeKind));
  }

  if (resolvedModelId) {
    conditions.push(ilike(chatRun.resolvedModelId, resolvedModelId));
  }

  const parsedDateFrom = parseDateStart(dateFrom);
  if (parsedDateFrom) {
    conditions.push(gte(chatRun.createdAt, parsedDateFrom));
  }

  const parsedDateToExclusive = parseDateExclusiveEnd(dateTo);
  if (parsedDateToExclusive) {
    conditions.push(lt(chatRun.createdAt, parsedDateToExclusive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [runs, totalResult, statusRows, routeRows, modelRows] = await Promise.all([
    db
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
        totalTokens: chatRun.totalTokens,
        errorMessage: chatRun.errorMessage,
        createdAt: chatRun.createdAt,
        completedAt: chatRun.completedAt,
      })
      .from(chatRun)
      .leftJoin(user, eq(chatRun.userId, user.id))
      .where(whereClause)
      .orderBy(desc(chatRun.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatRun)
      .leftJoin(user, eq(chatRun.userId, user.id))
      .where(whereClause)
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({
        key: chatRun.status,
        count: sql<number>`count(*)::int`,
      })
      .from(chatRun)
      .leftJoin(user, eq(chatRun.userId, user.id))
      .where(whereClause)
      .groupBy(chatRun.status),
    db
      .select({
        key: chatRun.routeKind,
        count: sql<number>`count(*)::int`,
      })
      .from(chatRun)
      .leftJoin(user, eq(chatRun.userId, user.id))
      .where(whereClause)
      .groupBy(chatRun.routeKind),
    db
      .select({
        key: chatRun.resolvedModelId,
        count: sql<number>`count(*)::int`,
      })
      .from(chatRun)
      .leftJoin(user, eq(chatRun.userId, user.id))
      .where(whereClause)
      .groupBy(chatRun.resolvedModelId),
  ]);

  const summary = {
    totalRuns: Number(totalResult),
    successCount: 0,
    errorCount: 0,
    pendingCount: 0,
    byRouteKind: routeRows.map((row) => ({ key: row.key, count: row.count })),
    byResolvedModel: modelRows.flatMap((row) => (row.key ? [{ key: row.key, count: row.count }] : [])),
  };

  for (const row of statusRows) {
    if (row.key === 'success') summary.successCount = row.count;
    if (row.key === 'error') summary.errorCount = row.count;
    if (row.key === 'pending') summary.pendingCount = row.count;
  }

  return Response.json({
    summary,
    runs: runs.map((run) => ({
      ...run,
      status: run.status === 'success' || run.status === 'error' ? run.status : 'pending',
      routeKind: run.routeKind === 'image' ? 'image' : 'text',
      routingMode: run.routingMode === 'manual' || run.routingMode === 'auto' ? run.routingMode : null,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(Number(totalResult) / limit)),
  });
}

function parseDateStart(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateExclusiveEnd(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed;
}
