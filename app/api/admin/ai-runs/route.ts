import { and, desc, eq, gte, ilike, lt, sql } from 'drizzle-orm';
import { chatRun, toolRun, user, workspaceAiRun } from '@/db/schema';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

type UnifiedRun = {
  id: string;
  runtime: 'chat' | 'workspace' | 'tool';
  title: string;
  subtitle: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  status: 'pending' | 'success' | 'error';
  createdAt: Date;
  completedAt: Date | null;
  routeKind: string | null;
  modelOrTarget: string | null;
};

const allowedStatuses = new Set(['pending', 'success', 'error']);
const allowedRuntimes = new Set(['chat', 'workspace', 'tool']);

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const url = new URL(req.url);
  const search = url.searchParams.get('search')?.trim() ?? '';
  const status = url.searchParams.get('status')?.trim() ?? '';
  const runtime = url.searchParams.get('runtime')?.trim() ?? '';
  const dateFrom = url.searchParams.get('dateFrom')?.trim() ?? '';
  const dateTo = url.searchParams.get('dateTo')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));

  const parsedDateFrom = parseDateStart(dateFrom);
  const parsedDateToExclusive = parseDateExclusiveEnd(dateTo);
  const filterStatus = allowedStatuses.has(status) ? status : null;
  const filterRuntime = allowedRuntimes.has(runtime) ? runtime : null;

  const [chatRows, workspaceRows, toolRows] = await Promise.all([
    filterRuntime && filterRuntime !== 'chat'
      ? Promise.resolve([] as UnifiedRun[])
      : db
          .select({
            id: chatRun.id,
            userId: chatRun.userId,
            userName: user.name,
            userEmail: user.email,
            status: chatRun.status,
            createdAt: chatRun.createdAt,
            completedAt: chatRun.completedAt,
            routeKind: chatRun.routeKind,
            modelOrTarget: chatRun.resolvedModelId,
            threadId: chatRun.threadId,
          })
          .from(chatRun)
          .leftJoin(user, eq(chatRun.userId, user.id))
          .where(buildChatWhere({ search, filterStatus, parsedDateFrom, parsedDateToExclusive }))
          .orderBy(desc(chatRun.createdAt))
          .limit(300)
          .then((rows) =>
            rows.map((row) => ({
              id: row.id,
              runtime: 'chat' as const,
              title: 'Chat Run',
              subtitle: row.threadId,
              userId: row.userId,
              userName: row.userName,
              userEmail: row.userEmail,
              status: normalizeStatus(row.status),
              createdAt: row.createdAt,
              completedAt: row.completedAt,
              routeKind: row.routeKind === 'image' ? 'image' : 'text',
              modelOrTarget: row.modelOrTarget,
            })),
          ),
    filterRuntime && filterRuntime !== 'workspace'
      ? Promise.resolve([] as UnifiedRun[])
      : db
          .select({
            id: workspaceAiRun.id,
            userId: workspaceAiRun.userId,
            userName: user.name,
            userEmail: user.email,
            status: workspaceAiRun.status,
            createdAt: workspaceAiRun.createdAt,
            completedAt: workspaceAiRun.completedAt,
            routeKind: workspaceAiRun.route,
            modelOrTarget: workspaceAiRun.modelId,
            kind: workspaceAiRun.kind,
            entityId: workspaceAiRun.entityId,
          })
          .from(workspaceAiRun)
          .leftJoin(user, eq(workspaceAiRun.userId, user.id))
          .where(buildWorkspaceWhere({ search, filterStatus, parsedDateFrom, parsedDateToExclusive }))
          .orderBy(desc(workspaceAiRun.createdAt))
          .limit(300)
          .then((rows) =>
            rows.map((row) => ({
              id: row.id,
              runtime: 'workspace' as const,
              title: formatKind(row.kind),
              subtitle: row.entityId,
              userId: row.userId,
              userName: row.userName,
              userEmail: row.userEmail,
              status: normalizeStatus(row.status),
              createdAt: row.createdAt,
              completedAt: row.completedAt,
              routeKind: row.routeKind === 'image' ? 'image' : 'text',
              modelOrTarget: row.modelOrTarget,
            })),
          ),
    filterRuntime && filterRuntime !== 'tool'
      ? Promise.resolve([] as UnifiedRun[])
      : db
          .select({
            id: toolRun.id,
            userId: toolRun.userId,
            userName: user.name,
            userEmail: user.email,
            status: toolRun.status,
            createdAt: toolRun.createdAt,
            completedAt: toolRun.completedAt,
            toolSlug: toolRun.toolSlug,
            source: toolRun.source,
          })
          .from(toolRun)
          .leftJoin(user, eq(toolRun.userId, user.id))
          .where(buildToolWhere({ search, filterStatus, parsedDateFrom, parsedDateToExclusive }))
          .orderBy(desc(toolRun.createdAt))
          .limit(300)
          .then((rows) =>
            rows.map((row) => ({
              id: row.id,
              runtime: 'tool' as const,
              title: row.toolSlug,
              subtitle: row.source,
              userId: row.userId,
              userName: row.userName,
              userEmail: row.userEmail,
              status: normalizeStatus(row.status),
              createdAt: row.createdAt,
              completedAt: row.completedAt,
              routeKind: null,
              modelOrTarget: row.source,
            })),
          ),
  ]);

  const merged = [...chatRows, ...workspaceRows, ...toolRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const totalRuns = merged.length;
  const start = (page - 1) * limit;
  const paged = merged.slice(start, start + limit);

  const summary = {
    totalRuns,
    successCount: merged.filter((run) => run.status === 'success').length,
    errorCount: merged.filter((run) => run.status === 'error').length,
    pendingCount: merged.filter((run) => run.status === 'pending').length,
    byRuntime: [
      { key: 'chat', count: merged.filter((run) => run.runtime === 'chat').length },
      { key: 'workspace', count: merged.filter((run) => run.runtime === 'workspace').length },
      { key: 'tool', count: merged.filter((run) => run.runtime === 'tool').length },
    ],
  };

  return Response.json({
    summary,
    runs: paged.map((run) => ({
      ...run,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    })),
    page,
    totalPages: Math.max(1, Math.ceil(totalRuns / limit)),
  });
}

function normalizeStatus(value: string): 'pending' | 'success' | 'error' {
  return value === 'success' || value === 'error' ? value : 'pending';
}

function formatKind(kind: string) {
  return kind.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function buildChatWhere(input: {
  search: string;
  filterStatus: string | null;
  parsedDateFrom: Date | null;
  parsedDateToExclusive: Date | null;
}) {
  const conditions = [];
  if (input.search) {
    const pattern = `%${input.search}%`;
    conditions.push(
      sql`(${chatRun.threadId} ILIKE ${pattern} OR ${chatRun.resolvedModelId} ILIKE ${pattern} OR ${user.email} ILIKE ${pattern} OR ${user.name} ILIKE ${pattern})`,
    );
  }
  if (input.filterStatus) conditions.push(eq(chatRun.status, input.filterStatus));
  if (input.parsedDateFrom) conditions.push(gte(chatRun.createdAt, input.parsedDateFrom));
  if (input.parsedDateToExclusive) conditions.push(lt(chatRun.createdAt, input.parsedDateToExclusive));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildWorkspaceWhere(input: {
  search: string;
  filterStatus: string | null;
  parsedDateFrom: Date | null;
  parsedDateToExclusive: Date | null;
}) {
  const conditions = [];
  if (input.search) {
    const pattern = `%${input.search}%`;
    conditions.push(
      sql`(${workspaceAiRun.kind} ILIKE ${pattern} OR ${workspaceAiRun.entityId} ILIKE ${pattern} OR ${workspaceAiRun.modelId} ILIKE ${pattern} OR ${user.email} ILIKE ${pattern} OR ${user.name} ILIKE ${pattern})`,
    );
  }
  if (input.filterStatus) conditions.push(eq(workspaceAiRun.status, input.filterStatus));
  if (input.parsedDateFrom) conditions.push(gte(workspaceAiRun.createdAt, input.parsedDateFrom));
  if (input.parsedDateToExclusive) conditions.push(lt(workspaceAiRun.createdAt, input.parsedDateToExclusive));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildToolWhere(input: {
  search: string;
  filterStatus: string | null;
  parsedDateFrom: Date | null;
  parsedDateToExclusive: Date | null;
}) {
  const conditions = [];
  if (input.search) {
    const pattern = `%${input.search}%`;
    conditions.push(
      sql`(${toolRun.toolSlug} ILIKE ${pattern} OR ${toolRun.source} ILIKE ${pattern} OR ${toolRun.threadId} ILIKE ${pattern} OR ${user.email} ILIKE ${pattern} OR ${user.name} ILIKE ${pattern})`,
    );
  }
  if (input.filterStatus) conditions.push(eq(toolRun.status, input.filterStatus));
  if (input.parsedDateFrom) conditions.push(gte(toolRun.createdAt, input.parsedDateFrom));
  if (input.parsedDateToExclusive) conditions.push(lt(toolRun.createdAt, input.parsedDateToExclusive));
  return conditions.length > 0 ? and(...conditions) : undefined;
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
