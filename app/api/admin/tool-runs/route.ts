import { and, desc, eq, gte, ilike, lt, sql } from 'drizzle-orm';
import { toolRun, user } from '@/db/schema';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

const allowedStatuses = new Set(['pending', 'success', 'error']);

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const url = new URL(req.url);
  const search = url.searchParams.get('search')?.trim() ?? '';
  const status = url.searchParams.get('status')?.trim() ?? '';
  const toolSlug = url.searchParams.get('toolSlug')?.trim() ?? '';
  const source = url.searchParams.get('source')?.trim() ?? '';
  const dateFrom = url.searchParams.get('dateFrom')?.trim() ?? '';
  const dateTo = url.searchParams.get('dateTo')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(${toolRun.toolSlug} ILIKE ${pattern} OR ${toolRun.threadId} ILIKE ${pattern} OR ${user.email} ILIKE ${pattern} OR ${user.name} ILIKE ${pattern})`,
    );
  }

  if (allowedStatuses.has(status)) {
    conditions.push(eq(toolRun.status, status));
  }

  if (toolSlug) {
    conditions.push(ilike(toolRun.toolSlug, toolSlug));
  }

  if (source) {
    conditions.push(ilike(toolRun.source, source));
  }

  const parsedDateFrom = parseDateStart(dateFrom);
  if (parsedDateFrom) {
    conditions.push(gte(toolRun.createdAt, parsedDateFrom));
  }

  const parsedDateToExclusive = parseDateExclusiveEnd(dateTo);
  if (parsedDateToExclusive) {
    conditions.push(lt(toolRun.createdAt, parsedDateToExclusive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [runs, totalResult, statusRows, slugRows, sourceRows] = await Promise.all([
    db
      .select({
        id: toolRun.id,
        userId: toolRun.userId,
        userName: user.name,
        userEmail: user.email,
        toolSlug: toolRun.toolSlug,
        threadId: toolRun.threadId,
        source: toolRun.source,
        status: toolRun.status,
        errorMessage: toolRun.errorMessage,
        createdAt: toolRun.createdAt,
        completedAt: toolRun.completedAt,
      })
      .from(toolRun)
      .leftJoin(user, eq(toolRun.userId, user.id))
      .where(whereClause)
      .orderBy(desc(toolRun.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(toolRun)
      .leftJoin(user, eq(toolRun.userId, user.id))
      .where(whereClause)
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({
        key: toolRun.status,
        count: sql<number>`count(*)::int`,
      })
      .from(toolRun)
      .leftJoin(user, eq(toolRun.userId, user.id))
      .where(whereClause)
      .groupBy(toolRun.status),
    db
      .select({
        key: toolRun.toolSlug,
        count: sql<number>`count(*)::int`,
      })
      .from(toolRun)
      .leftJoin(user, eq(toolRun.userId, user.id))
      .where(whereClause)
      .groupBy(toolRun.toolSlug),
    db
      .select({
        key: toolRun.source,
        count: sql<number>`count(*)::int`,
      })
      .from(toolRun)
      .leftJoin(user, eq(toolRun.userId, user.id))
      .where(whereClause)
      .groupBy(toolRun.source),
  ]);

  const summary = {
    totalRuns: Number(totalResult),
    successCount: 0,
    errorCount: 0,
    pendingCount: 0,
    byToolSlug: slugRows.map((row) => ({ key: row.key, count: row.count })),
    bySource: sourceRows.map((row) => ({ key: row.key, count: row.count })),
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
