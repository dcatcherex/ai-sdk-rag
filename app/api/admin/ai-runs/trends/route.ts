import { gte, lt, sql } from 'drizzle-orm';
import { chatRun, toolRun, workspaceAiRun } from '@/db/schema';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

type RuntimeTrendRow = {
  day: string;
  runtime: 'chat' | 'workspace' | 'tool';
  runCount: number;
  errorCount: number;
  tokenTotal: number;
  creditTotal: number;
};

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get('dateFrom')?.trim() ?? '';
  const dateTo = url.searchParams.get('dateTo')?.trim() ?? '';

  const endExclusive = parseDateExclusiveEnd(dateTo) ?? tomorrowUtc();
  const startInclusive = parseDateStart(dateFrom) ?? daysBeforeUtc(endExclusive, 29);

  const durationMs = endExclusive.getTime() - startInclusive.getTime();
  const prevEndExclusive = startInclusive;
  const prevStartInclusive = new Date(startInclusive.getTime() - durationMs);

  const [chatRows, workspaceRows, toolRows, latencyRow, prevChatRow, prevWorkspaceRow, prevToolRow] = await Promise.all([
    db.execute(sql`
      select
        to_char(date_trunc('day', ${chatRun.createdAt}), 'YYYY-MM-DD') as day,
        count(*)::int as run_count,
        count(*) filter (where ${chatRun.status} = 'error')::int as error_count,
        coalesce(sum(${chatRun.totalTokens}), 0)::int as token_total,
        coalesce(sum(${chatRun.creditCost}), 0)::int as credit_total
      from ${chatRun}
      where ${chatRun.createdAt} >= ${startInclusive}
        and ${chatRun.createdAt} < ${endExclusive}
      group by 1
      order by 1 asc
    `),
    db.execute(sql`
      select
        to_char(date_trunc('day', ${workspaceAiRun.createdAt}), 'YYYY-MM-DD') as day,
        count(*)::int as run_count,
        count(*) filter (where ${workspaceAiRun.status} = 'error')::int as error_count
      from ${workspaceAiRun}
      where ${workspaceAiRun.createdAt} >= ${startInclusive}
        and ${workspaceAiRun.createdAt} < ${endExclusive}
      group by 1
      order by 1 asc
    `),
    db.execute(sql`
      select
        to_char(date_trunc('day', ${toolRun.createdAt}), 'YYYY-MM-DD') as day,
        count(*)::int as run_count,
        count(*) filter (where ${toolRun.status} = 'error')::int as error_count
      from ${toolRun}
      where ${toolRun.createdAt} >= ${startInclusive}
        and ${toolRun.createdAt} < ${endExclusive}
      group by 1
      order by 1 asc
    `),
    db.execute(sql`
      select
        round(avg(extract(epoch from (${chatRun.completedAt} - ${chatRun.startedAt})) * 1000))::int as avg_latency_ms
      from ${chatRun}
      where ${chatRun.createdAt} >= ${startInclusive}
        and ${chatRun.createdAt} < ${endExclusive}
        and ${chatRun.completedAt} is not null
        and ${chatRun.startedAt} is not null
    `),
    db.execute(sql`
      select
        coalesce(count(*)::int, 0) as run_count,
        coalesce(count(*) filter (where ${chatRun.status} = 'error')::int, 0) as error_count,
        coalesce(sum(${chatRun.totalTokens}), 0)::int as token_total,
        coalesce(sum(${chatRun.creditCost}), 0)::int as credit_total
      from ${chatRun}
      where ${chatRun.createdAt} >= ${prevStartInclusive}
        and ${chatRun.createdAt} < ${prevEndExclusive}
    `),
    db.execute(sql`
      select
        coalesce(count(*)::int, 0) as run_count,
        coalesce(count(*) filter (where ${workspaceAiRun.status} = 'error')::int, 0) as error_count
      from ${workspaceAiRun}
      where ${workspaceAiRun.createdAt} >= ${prevStartInclusive}
        and ${workspaceAiRun.createdAt} < ${prevEndExclusive}
    `),
    db.execute(sql`
      select
        coalesce(count(*)::int, 0) as run_count,
        coalesce(count(*) filter (where ${toolRun.status} = 'error')::int, 0) as error_count
      from ${toolRun}
      where ${toolRun.createdAt} >= ${prevStartInclusive}
        and ${toolRun.createdAt} < ${prevEndExclusive}
    `),
  ]);

  const runtimeRows: RuntimeTrendRow[] = [
    ...normalizeTrendRows(chatRows.rows, 'chat'),
    ...normalizeTrendRows(workspaceRows.rows, 'workspace'),
    ...normalizeTrendRows(toolRows.rows, 'tool'),
  ];

  const avgLatencyMs = latencyRow.rows[0]?.avg_latency_ms != null
    ? Number(latencyRow.rows[0].avg_latency_ms)
    : null;

  const prevChat = prevChatRow.rows[0] ?? {};
  const prevWorkspace = prevWorkspaceRow.rows[0] ?? {};
  const prevTool = prevToolRow.rows[0] ?? {};
  const prevSummary = {
    totalRuns: Number(prevChat.run_count ?? 0) + Number(prevWorkspace.run_count ?? 0) + Number(prevTool.run_count ?? 0),
    totalErrors: Number(prevChat.error_count ?? 0) + Number(prevWorkspace.error_count ?? 0) + Number(prevTool.error_count ?? 0),
    totalTokens: Number(prevChat.token_total ?? 0),
    totalCredits: Number(prevChat.credit_total ?? 0),
  };

  const allDays = buildDayRange(startInclusive, endExclusive);
  const daily = allDays.map((day) => {
    const chat = runtimeRows.find((row) => row.runtime === 'chat' && row.day === day) ?? emptyTrendRow(day, 'chat');
    const workspace =
      runtimeRows.find((row) => row.runtime === 'workspace' && row.day === day) ?? emptyTrendRow(day, 'workspace');
    const tool = runtimeRows.find((row) => row.runtime === 'tool' && row.day === day) ?? emptyTrendRow(day, 'tool');

    return {
      day,
      chat,
      workspace,
      tool,
      totalRuns: chat.runCount + workspace.runCount + tool.runCount,
      totalErrors: chat.errorCount + workspace.errorCount + tool.errorCount,
      totalTokens: chat.tokenTotal + workspace.tokenTotal + tool.tokenTotal,
      totalCredits: chat.creditTotal + workspace.creditTotal + tool.creditTotal,
    };
  });

  const summary = {
    totalRuns: daily.reduce((sum, row) => sum + row.totalRuns, 0),
    totalErrors: daily.reduce((sum, row) => sum + row.totalErrors, 0),
    totalTokens: daily.reduce((sum, row) => sum + row.totalTokens, 0),
    totalCredits: daily.reduce((sum, row) => sum + row.totalCredits, 0),
    byRuntime: {
      chat: sumRuntime(daily, 'chat'),
      workspace: sumRuntime(daily, 'workspace'),
      tool: sumRuntime(daily, 'tool'),
    },
  };

  return Response.json({
    range: {
      dateFrom: toDateString(startInclusive),
      dateTo: toDateString(new Date(endExclusive.getTime() - 86400000)),
    },
    summary,
    prevSummary,
    avgLatencyMs,
    daily,
  });
}

function normalizeTrendRows(
  rows: Array<Record<string, unknown>>,
  runtime: 'chat' | 'workspace' | 'tool',
): RuntimeTrendRow[] {
  return rows.map((row) => ({
    day: String(row.day),
    runtime,
    runCount: Number(row.run_count ?? 0),
    errorCount: Number(row.error_count ?? 0),
    tokenTotal: Number(row.token_total ?? 0),
    creditTotal: Number(row.credit_total ?? 0),
  }));
}

function emptyTrendRow(day: string, runtime: 'chat' | 'workspace' | 'tool'): RuntimeTrendRow {
  return {
    day,
    runtime,
    runCount: 0,
    errorCount: 0,
    tokenTotal: 0,
    creditTotal: 0,
  };
}

function sumRuntime(
  daily: Array<{
    chat: RuntimeTrendRow;
    workspace: RuntimeTrendRow;
    tool: RuntimeTrendRow;
  }>,
  runtime: 'chat' | 'workspace' | 'tool',
) {
  return daily.reduce(
    (acc, row) => {
      const current = row[runtime];
      acc.runCount += current.runCount;
      acc.errorCount += current.errorCount;
      acc.tokenTotal += current.tokenTotal;
      acc.creditTotal += current.creditTotal;
      return acc;
    },
    { runCount: 0, errorCount: 0, tokenTotal: 0, creditTotal: 0 },
  );
}

function buildDayRange(startInclusive: Date, endExclusive: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(startInclusive);

  while (cursor < endExclusive) {
    days.push(toDateString(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
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

function tomorrowUtc() {
  const today = new Date();
  const utc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() + 1);
  return utc;
}

function daysBeforeUtc(dateExclusive: Date, dayCount: number) {
  const copy = new Date(dateExclusive);
  copy.setUTCDate(copy.getUTCDate() - dayCount - 1);
  return copy;
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}
