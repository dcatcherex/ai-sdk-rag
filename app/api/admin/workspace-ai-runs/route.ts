import { and, desc, eq, gte, ilike, lt, sql } from 'drizzle-orm';
import { user, workspaceAiRun } from '@/db/schema';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

const allowedStatuses = new Set(['pending', 'success', 'error']);
const allowedRoutes = new Set(['text', 'image']);

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const url = new URL(req.url);
  const search = url.searchParams.get('search')?.trim() ?? '';
  const status = url.searchParams.get('status')?.trim() ?? '';
  const route = url.searchParams.get('route')?.trim() ?? '';
  const kind = url.searchParams.get('kind')?.trim() ?? '';
  const modelId = url.searchParams.get('modelId')?.trim() ?? '';
  const dateFrom = url.searchParams.get('dateFrom')?.trim() ?? '';
  const dateTo = url.searchParams.get('dateTo')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(${workspaceAiRun.kind} ILIKE ${pattern} OR ${workspaceAiRun.entityId} ILIKE ${pattern} OR ${user.email} ILIKE ${pattern} OR ${user.name} ILIKE ${pattern})`,
    );
  }

  if (allowedStatuses.has(status)) {
    conditions.push(eq(workspaceAiRun.status, status));
  }

  if (allowedRoutes.has(route)) {
    conditions.push(eq(workspaceAiRun.route, route));
  }

  if (kind) {
    conditions.push(ilike(workspaceAiRun.kind, kind));
  }

  if (modelId) {
    conditions.push(ilike(workspaceAiRun.modelId, modelId));
  }

  const parsedDateFrom = parseDateStart(dateFrom);
  if (parsedDateFrom) {
    conditions.push(gte(workspaceAiRun.createdAt, parsedDateFrom));
  }

  const parsedDateToExclusive = parseDateExclusiveEnd(dateTo);
  if (parsedDateToExclusive) {
    conditions.push(lt(workspaceAiRun.createdAt, parsedDateToExclusive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [runs, totalResult, statusRows, kindRows, routeRows, modelRows] = await Promise.all([
    db
      .select({
        id: workspaceAiRun.id,
        userId: workspaceAiRun.userId,
        userName: user.name,
        userEmail: user.email,
        kind: workspaceAiRun.kind,
        entityType: workspaceAiRun.entityType,
        entityId: workspaceAiRun.entityId,
        route: workspaceAiRun.route,
        status: workspaceAiRun.status,
        modelId: workspaceAiRun.modelId,
        errorMessage: workspaceAiRun.errorMessage,
        createdAt: workspaceAiRun.createdAt,
        completedAt: workspaceAiRun.completedAt,
      })
      .from(workspaceAiRun)
      .leftJoin(user, eq(workspaceAiRun.userId, user.id))
      .where(whereClause)
      .orderBy(desc(workspaceAiRun.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceAiRun)
      .leftJoin(user, eq(workspaceAiRun.userId, user.id))
      .where(whereClause)
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({
        key: workspaceAiRun.status,
        count: sql<number>`count(*)::int`,
      })
      .from(workspaceAiRun)
      .leftJoin(user, eq(workspaceAiRun.userId, user.id))
      .where(whereClause)
      .groupBy(workspaceAiRun.status),
    db
      .select({
        key: workspaceAiRun.kind,
        count: sql<number>`count(*)::int`,
      })
      .from(workspaceAiRun)
      .leftJoin(user, eq(workspaceAiRun.userId, user.id))
      .where(whereClause)
      .groupBy(workspaceAiRun.kind),
    db
      .select({
        key: workspaceAiRun.route,
        count: sql<number>`count(*)::int`,
      })
      .from(workspaceAiRun)
      .leftJoin(user, eq(workspaceAiRun.userId, user.id))
      .where(whereClause)
      .groupBy(workspaceAiRun.route),
    db
      .select({
        key: workspaceAiRun.modelId,
        count: sql<number>`count(*)::int`,
      })
      .from(workspaceAiRun)
      .leftJoin(user, eq(workspaceAiRun.userId, user.id))
      .where(whereClause)
      .groupBy(workspaceAiRun.modelId),
  ]);

  const summary = {
    totalRuns: Number(totalResult),
    successCount: 0,
    errorCount: 0,
    pendingCount: 0,
    byKind: kindRows.map((row) => ({ key: row.key, count: row.count })),
    byRoute: routeRows.map((row) => ({ key: row.key, count: row.count })),
    byModel: modelRows.flatMap((row) => (row.key ? [{ key: row.key, count: row.count }] : [])),
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
      route: run.route === 'image' ? 'image' : 'text',
      status: run.status === 'success' || run.status === 'error' ? run.status : 'pending',
      entityType: run.entityType === 'skill' ? 'skill' : 'agent',
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
